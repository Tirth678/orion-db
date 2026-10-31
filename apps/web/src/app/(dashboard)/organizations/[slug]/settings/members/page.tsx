import { MembersClient } from '@/features/members/members-client';
import {
  retrieveInvitationsFromApi,
  retrieveMembersFromApi,
} from '@/features/members/members-helpers.server';
import { retrieveOrganizationBySlugFromApi } from '@/features/organization/organization-helpers.server';

export default async function MembersSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const [org, members, invitations] = await Promise.all([
    retrieveOrganizationBySlugFromApi(slug),
    retrieveMembersFromApi(slug),
    retrieveInvitationsFromApi(slug),
  ]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-medium">Members</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage who has access to {org.name}
        </p>
      </div>
      <MembersClient
        slug={slug}
        members={members}
        invitations={invitations}
        currentUserRole={org.role}
      />
    </div>
  );
}
