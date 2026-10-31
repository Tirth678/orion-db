import { redirect } from 'next/navigation';
import apiClient from '@/lib/axios';
import { retrieveTokenFromCookie } from '@/server-utils/utils';
import { COOKIE_KEYS } from '@orion/constants';
import type { OrgInvitationWithInviter, OrgMemberWithUser } from '@orion/types';

export async function retrieveMembersFromApi(
  slug: string,
): Promise<OrgMemberWithUser[]> {
  const token = await retrieveTokenFromCookie();

  try {
    const { data } = await apiClient.get<OrgMemberWithUser[]>(
      `/orgs/${slug}/members`,
      { headers: { Cookie: `${COOKIE_KEYS.ACCESS_TOKEN}=${token}` } },
    );
    return data;
  } catch {
    redirect('/organizations');
  }
}

export async function retrieveInvitationsFromApi(
  slug: string,
): Promise<OrgInvitationWithInviter[]> {
  const token = await retrieveTokenFromCookie();

  try {
    const { data } = await apiClient.get<OrgInvitationWithInviter[]>(
      `/orgs/${slug}/members/invitations`,
      { headers: { Cookie: `${COOKIE_KEYS.ACCESS_TOKEN}=${token}` } },
    );
    return data;
  } catch {
    return [];
  }
}
