import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { createHash } from 'crypto';
import * as bcrypt from 'bcrypt';
import { DrizzleService } from '../db/drizzle.service';
import {
  organizations,
  orgInvitations,
  orgMembers,
  users,
} from '../db/schema';
import { INVITE_EXPIRES_IN } from '@orion/constants';
import { OrgRole } from '@orion/types';

interface InvitePayload {
  email: string;
  orgId: string;
  orgName: string;
  role?: OrgRole;
}

@Injectable()
export class InviteService {
  private readonly logger = new Logger(InviteService.name);
  private resend: Resend;

  constructor(
    private drizzle: DrizzleService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {
    this.resend = new Resend(
      this.configService.get('RESEND_API_KEY') || 're_placeholder_dev_key',
    );
  }

  async sendInvite(
    orgSlug: string,
    email: string,
    role?: OrgRole,
    invitedById?: string,
  ) {
    const targetRole: OrgRole = role ?? 'developer';

    // get the org
    const [org] = await this.drizzle.db
      .select()
      .from(organizations)
      .where(eq(organizations.slug, orgSlug))
      .limit(1);

    if (!org) throw new BadRequestException('Organization not found');

    // check if user is already an active member
    const existingUser = await this.drizzle.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingUser.length > 0) {
      const existingMember = await this.drizzle.db
        .select()
        .from(orgMembers)
        .where(
          and(
            eq(orgMembers.orgId, org.id),
            eq(orgMembers.userId, existingUser[0].id),
            isNull(orgMembers.removedAt),
          ),
        )
        .limit(1);

      if (existingMember.length > 0) {
        throw new BadRequestException(
          'User is already a member of this organization',
        );
      }
    }

    // sign invite token — expires in 24h
    const payload: InvitePayload = {
      email,
      orgId: org.id,
      orgName: org.name,
      role: targetRole,
    };

    const token = this.jwtService.sign(payload, {
      secret: this.configService.get('INVITE_SECRET'),
      expiresIn: INVITE_EXPIRES_IN,
    });

    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Invalidate any existing pending invites for this org + email
    await this.drizzle.db
      .update(orgInvitations)
      .set({ status: 'revoked' })
      .where(
        and(
          eq(orgInvitations.orgId, org.id),
          eq(orgInvitations.email, email),
          eq(orgInvitations.status, 'pending'),
        ),
      );

    // Insert new invitation record
    const [invitation] = await this.drizzle.db
      .insert(orgInvitations)
      .values({
        orgId: org.id,
        email,
        role: targetRole,
        tokenHash,
        invitedBy: invitedById ?? null,
        status: 'pending',
        expiresAt,
      })
      .returning();

    const webUrl =
      this.configService.get<string>('WEB_URL') || 'http://localhost:3000';
    const inviteUrl = `${webUrl}/accept-invite?token=${token}`;

    const fromEmail =
      this.configService.get<string>('RESEND_FROM') ||
      this.configService.get<string>('EMAIL_FROM') ||
      'onboarding@resend.dev';

    // send the email via Resend and handle errors
    const { error } = await this.resend.emails.send({
      from: fromEmail,
      to: email,
      subject: `You've been invited to join ${org.name} on Orion`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #111;">
          <h2>You're invited to join ${org.name}</h2>
          <p>You have been invited to collaborate as a <strong>${targetRole}</strong> on Orion.</p>
          <a
            href="${inviteUrl}"
            style="display: inline-block; background: #000; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 16px 0;">
            Accept invite
          </a>
          <p style="color: #666; font-size: 13px;">This invitation expires in 24 hours.</p>
        </div>
      `,
    });

    if (error) {
      this.logger.error(
        `Failed to send invite email to ${email}: ${error.message}`,
        error,
      );

      if (
        fromEmail === 'onboarding@resend.dev' &&
        error.name === 'validation_error'
      ) {
        throw new BadRequestException(
          'Resend test domain (onboarding@resend.dev) can only send emails to your verified account email. Please configure RESEND_FROM with a verified domain to invite other emails.',
        );
      }

      throw new BadRequestException(
        `Failed to send invitation email: ${error.message}`,
      );
    }

    return { message: 'Invite sent', invitationId: invitation.id };
  }

  async getInvitations(orgSlug: string) {
    const [org] = await this.drizzle.db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.slug, orgSlug))
      .limit(1);

    if (!org) throw new BadRequestException('Organization not found');

    const rows = await this.drizzle.db
      .select({
        id: orgInvitations.id,
        orgId: orgInvitations.orgId,
        email: orgInvitations.email,
        role: orgInvitations.role,
        status: orgInvitations.status,
        invitedBy: orgInvitations.invitedBy,
        expiresAt: orgInvitations.expiresAt,
        createdAt: orgInvitations.createdAt,
        acceptedAt: orgInvitations.acceptedAt,
        inviterName: users.name,
        inviterEmail: users.email,
      })
      .from(orgInvitations)
      .leftJoin(users, eq(orgInvitations.invitedBy, users.id))
      .where(
        and(
          eq(orgInvitations.orgId, org.id),
          eq(orgInvitations.status, 'pending'),
        ),
      )
      .orderBy(desc(orgInvitations.createdAt));

    return rows.map((row) => ({
      id: row.id,
      orgId: row.orgId,
      email: row.email,
      role: row.role,
      status: row.status,
      invitedBy: row.invitedBy,
      expiresAt: row.expiresAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
      acceptedAt: row.acceptedAt ? row.acceptedAt.toISOString() : null,
      inviter: row.invitedBy
        ? {
            id: row.invitedBy,
            name: row.inviterName,
            email: row.inviterEmail ?? '',
          }
        : null,
    }));
  }

  async revokeInvitation(orgSlug: string, invitationId: string) {
    const [org] = await this.drizzle.db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.slug, orgSlug))
      .limit(1);

    if (!org) throw new BadRequestException('Organization not found');

    const [invitation] = await this.drizzle.db
      .select()
      .from(orgInvitations)
      .where(
        and(
          eq(orgInvitations.id, invitationId),
          eq(orgInvitations.orgId, org.id),
        ),
      )
      .limit(1);

    if (!invitation) throw new NotFoundException('Invitation not found');

    await this.drizzle.db
      .update(orgInvitations)
      .set({ status: 'revoked' })
      .where(eq(orgInvitations.id, invitationId));

    return { message: 'Invitation revoked' };
  }

  async verifyInvite(token: string) {
    let payload: InvitePayload;

    try {
      payload = this.jwtService.verify<InvitePayload>(token, {
        secret: this.configService.get('INVITE_SECRET'),
      });
    } catch {
      throw new BadRequestException('Invalid or expired invite link');
    }

    const tokenHash = createHash('sha256').update(token).digest('hex');
    const [invitation] = await this.drizzle.db
      .select()
      .from(orgInvitations)
      .where(eq(orgInvitations.tokenHash, tokenHash))
      .limit(1);

    if (invitation) {
      if (invitation.status !== 'pending' || invitation.expiresAt < new Date()) {
        if (invitation.status === 'pending') {
          await this.drizzle.db
            .update(orgInvitations)
            .set({ status: 'expired' })
            .where(eq(orgInvitations.id, invitation.id));
        }
        throw new BadRequestException('Invalid or expired invite link');
      }
    }

    const [existingUser] = await this.drizzle.db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        passwordHash: users.passwordHash,
      })
      .from(users)
      .where(eq(users.email, payload.email))
      .limit(1);

    return {
      valid: true,
      email: payload.email,
      orgName: payload.orgName,
      role: invitation?.role ?? payload.role ?? 'developer',
      userExists: !!existingUser,
      hasPassword: !!existingUser?.passwordHash,
    };
  }

  async acceptInvite(
    token: string,
    options?: { name?: string; password?: string },
  ) {
    let payload: InvitePayload;

    try {
      payload = this.jwtService.verify<InvitePayload>(token, {
        secret: this.configService.get('INVITE_SECRET'),
      });
    } catch {
      throw new BadRequestException('Invalid or expired invite link');
    }

    const tokenHash = createHash('sha256').update(token).digest('hex');
    const [invitation] = await this.drizzle.db
      .select()
      .from(orgInvitations)
      .where(eq(orgInvitations.tokenHash, tokenHash))
      .limit(1);

    if (invitation) {
      if (invitation.status !== 'pending' || invitation.expiresAt < new Date()) {
        if (invitation.status === 'pending') {
          await this.drizzle.db
            .update(orgInvitations)
            .set({ status: 'expired' })
            .where(eq(orgInvitations.id, invitation.id));
        }
        throw new BadRequestException('Invalid or expired invite link');
      }
    }

    let [user] = await this.drizzle.db
      .select()
      .from(users)
      .where(eq(users.email, payload.email))
      .limit(1);

    if (!user) {
      const passwordHash = options?.password
        ? await bcrypt.hash(options.password, 10)
        : null;

      const [newUser] = await this.drizzle.db
        .insert(users)
        .values({
          email: payload.email,
          name: options?.name ?? null,
          passwordHash,
        })
        .returning();
      user = newUser;
    } else if (options?.password && !user.passwordHash) {
      const passwordHash = await bcrypt.hash(options.password, 10);
      const [updated] = await this.drizzle.db
        .update(users)
        .set({
          passwordHash,
          name: user.name ?? options.name ?? null,
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id))
        .returning();
      user = updated;
    }

    const existing = await this.drizzle.db
      .select()
      .from(orgMembers)
      .where(
        and(
          eq(orgMembers.orgId, payload.orgId),
          eq(orgMembers.userId, user.id),
          isNull(orgMembers.removedAt),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      if (invitation && invitation.status === 'pending') {
        await this.drizzle.db
          .update(orgInvitations)
          .set({ status: 'accepted', acceptedAt: new Date() })
          .where(eq(orgInvitations.id, invitation.id));
      }
      return { message: 'Already a member' };
    }

    const assignedRole: OrgRole =
      invitation?.role ?? payload.role ?? 'developer';

    await this.drizzle.db.insert(orgMembers).values({
      orgId: payload.orgId,
      userId: user.id,
      role: assignedRole,
    });

    if (invitation) {
      await this.drizzle.db
        .update(orgInvitations)
        .set({ status: 'accepted', acceptedAt: new Date() })
        .where(eq(orgInvitations.id, invitation.id));
    }

    return { message: 'Invite accepted', email: user.email, user };
  }
}
