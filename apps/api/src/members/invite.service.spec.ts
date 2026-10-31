import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InviteService } from './invite.service';

describe('InviteService', () => {
  let service: InviteService;
  let drizzle: any;
  let jwtService: any;
  let configService: any;

  beforeEach(() => {
    drizzle = {
      db: {
        select: jest.fn(),
        insert: jest.fn(),
        update: jest.fn(),
      },
    };
    jwtService = {
      sign: jest.fn().mockReturnValue('mock.jwt.invite.token'),
      verify: jest.fn(),
    };
    configService = {
      get: jest.fn((key: string) => {
        if (key === 'INVITE_SECRET') return 'test-invite-secret';
        if (key === 'WEB_URL') return 'http://localhost:3000';
        if (key === 'RESEND_API_KEY') return 'test-resend-key';
        return null;
      }),
    };

    service = new InviteService(drizzle, jwtService, configService);
  });

  describe('sendInvite', () => {
    it('throws BadRequestException if organization is not found', async () => {
      drizzle.db.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValueOnce({
          where: jest.fn().mockReturnValueOnce({
            limit: jest.fn().mockResolvedValueOnce([]),
          }),
        }),
      });

      await expect(
        service.sendInvite('non-existent-org', 'user@example.com'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException if recipient is already an active member', async () => {
      const org = { id: 'org_1', name: 'Acme', slug: 'acme' };
      const user = { id: 'usr_1' };

      // org lookup
      drizzle.db.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValueOnce({
          where: jest.fn().mockReturnValueOnce({
            limit: jest.fn().mockResolvedValueOnce([org]),
          }),
        }),
      });

      // existing user lookup
      drizzle.db.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValueOnce({
          where: jest.fn().mockReturnValueOnce({
            limit: jest.fn().mockResolvedValueOnce([user]),
          }),
        }),
      });

      // active membership lookup
      drizzle.db.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValueOnce({
          where: jest.fn().mockReturnValueOnce({
            limit: jest.fn().mockResolvedValueOnce([{ id: 'mem_1' }]),
          }),
        }),
      });

      await expect(
        service.sendInvite('acme', 'existing@example.com'),
      ).rejects.toThrow('User is already a member of this organization');
    });

    it('creates invitation and sends email when valid', async () => {
      const org = { id: 'org_1', name: 'Acme', slug: 'acme' };

      // org lookup
      drizzle.db.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValueOnce({
          where: jest.fn().mockReturnValueOnce({
            limit: jest.fn().mockResolvedValueOnce([org]),
          }),
        }),
      });

      // user lookup: not found
      drizzle.db.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValueOnce({
          where: jest.fn().mockReturnValueOnce({
            limit: jest.fn().mockResolvedValueOnce([]),
          }),
        }),
      });

      // revoke previous pending invites
      drizzle.db.update.mockReturnValueOnce({
        set: jest.fn().mockReturnValueOnce({
          where: jest.fn().mockResolvedValueOnce([]),
        }),
      });

      // insert new invitation
      drizzle.db.insert.mockReturnValueOnce({
        values: jest.fn().mockReturnValueOnce({
          returning: jest.fn().mockResolvedValueOnce([{ id: 'inv_123' }]),
        }),
      });

      // Mock Resend send
      (service as any).resend = {
        emails: {
          send: jest
            .fn()
            .mockResolvedValueOnce({ data: { id: 'msg_1' }, error: null }),
        },
      };

      const result = await service.sendInvite(
        'acme',
        'new@example.com',
        'admin',
        'admin_1',
      );

      expect(result).toEqual({
        message: 'Invite sent',
        invitationId: 'inv_123',
      });
      expect((service as any).resend.emails.send).toHaveBeenCalled();
    });

    it('catches Resend test domain error and provides informative feedback', async () => {
      const org = { id: 'org_1', name: 'Acme', slug: 'acme' };

      drizzle.db.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValueOnce({
          where: jest.fn().mockReturnValueOnce({
            limit: jest.fn().mockResolvedValueOnce([org]),
          }),
        }),
      });

      drizzle.db.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValueOnce({
          where: jest.fn().mockReturnValueOnce({
            limit: jest.fn().mockResolvedValueOnce([]),
          }),
        }),
      });

      drizzle.db.update.mockReturnValueOnce({
        set: jest.fn().mockReturnValueOnce({
          where: jest.fn().mockResolvedValueOnce([]),
        }),
      });

      drizzle.db.insert.mockReturnValueOnce({
        values: jest.fn().mockReturnValueOnce({
          returning: jest.fn().mockResolvedValueOnce([{ id: 'inv_123' }]),
        }),
      });

      (service as any).resend = {
        emails: {
          send: jest.fn().mockResolvedValueOnce({
            data: null,
            error: {
              name: 'validation_error',
              message: 'You can only send to your own email address',
            },
          }),
        },
      };

      await expect(
        service.sendInvite('acme', 'other@example.com'),
      ).rejects.toThrow(
        'Resend test domain (onboarding@resend.dev) can only send emails to your verified account email',
      );
    });
  });

  describe('revokeInvitation', () => {
    it('revokes an invitation successfully', async () => {
      drizzle.db.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValueOnce({
          where: jest.fn().mockReturnValueOnce({
            limit: jest.fn().mockResolvedValueOnce([{ id: 'org_1' }]),
          }),
        }),
      });

      drizzle.db.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValueOnce({
          where: jest.fn().mockReturnValueOnce({
            limit: jest.fn().mockResolvedValueOnce([{ id: 'inv_1' }]),
          }),
        }),
      });

      drizzle.db.update.mockReturnValueOnce({
        set: jest.fn().mockReturnValueOnce({
          where: jest.fn().mockResolvedValueOnce([]),
        }),
      });

      const res = await service.revokeInvitation('acme', 'inv_1');
      expect(res).toEqual({ message: 'Invitation revoked' });
    });

    it('throws NotFoundException if invitation does not exist in org', async () => {
      drizzle.db.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValueOnce({
          where: jest.fn().mockReturnValueOnce({
            limit: jest.fn().mockResolvedValueOnce([{ id: 'org_1' }]),
          }),
        }),
      });

      drizzle.db.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValueOnce({
          where: jest.fn().mockReturnValueOnce({
            limit: jest.fn().mockResolvedValueOnce([]),
          }),
        }),
      });

      await expect(service.revokeInvitation('acme', 'inv_999')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
