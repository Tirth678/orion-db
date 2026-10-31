'use server';

import { revalidatePath } from 'next/cache';
import { membersServerSchema } from './server.schema';
import { MEMBERS_INTENT } from './constants';
import { COOKIE_KEYS } from '@orion/constants';
import type { OrgRole } from '@orion/types';
import { retrieveTokenFromCookie } from '@/server-utils/utils';
import apiClient from '@/lib/axios';

export type MembersActionState = {
  error?: string;
  success?: string;
};

export async function membersAction(
  { slug }: { slug: string },
  _prev: MembersActionState,
  formData: FormData,
): Promise<MembersActionState> {
  const raw = Object.fromEntries(formData);
  const parsed = membersServerSchema.safeParse(raw);

  if (!parsed.success) {
    return { error: parsed.error.flatten().formErrors[0] ?? 'Invalid input' };
  }

  const token = await retrieveTokenFromCookie();
  const { intent, ...data } = parsed.data;

  try {
    switch (intent) {
      case MEMBERS_INTENT.INVITE: {
        const inviteData = data as { email: string; role?: OrgRole };
        await apiClient.post(
          `/orgs/${slug}/members/invite`,
          { email: inviteData.email, role: inviteData.role },
          { headers: { Cookie: `${COOKIE_KEYS.ACCESS_TOKEN}=${token}` } },
        );
        revalidatePath(`/organizations/${slug}/settings/members`);
        return { success: 'Invite sent!' };
      }

      case MEMBERS_INTENT.UPDATE_ROLE: {
        const { memberId, role } = data as { memberId: string; role: string };
        await apiClient.patch(
          `/orgs/${slug}/members/${memberId}/role`,
          { role },
          { headers: { Cookie: `${COOKIE_KEYS.ACCESS_TOKEN}=${token}` } },
        );
        revalidatePath(`/organizations/${slug}/settings/members`);
        return { success: 'Role updated' };
      }

      case MEMBERS_INTENT.REMOVE: {
        const { memberId } = data as { memberId: string };
        await apiClient.delete(`/orgs/${slug}/members/${memberId}`, {
          headers: { Cookie: `${COOKIE_KEYS.ACCESS_TOKEN}=${token}` },
        });
        revalidatePath(`/organizations/${slug}/settings/members`);
        return { success: 'Member removed' };
      }

      case MEMBERS_INTENT.REVOKE_INVITE: {
        const { invitationId } = data as { invitationId: string };
        await apiClient.delete(
          `/orgs/${slug}/members/invitations/${invitationId}`,
          {
            headers: { Cookie: `${COOKIE_KEYS.ACCESS_TOKEN}=${token}` },
          },
        );
        revalidatePath(`/organizations/${slug}/settings/members`);
        return { success: 'Invitation revoked' };
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    return { error: err.response?.data?.message ?? 'Something went wrong' };
  }
}
