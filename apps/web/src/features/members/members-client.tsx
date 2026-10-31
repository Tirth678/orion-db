'use client';

import { useActionState } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldError, FieldGroup } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ORG_ROLES } from '@orion/constants';
import type {
  OrgInvitationWithInviter,
  OrgMemberWithUser,
  OrgRole,
} from '@orion/types';
import { membersAction } from './action';
import { Controller, useForm } from 'react-hook-form';
import z from 'zod';
import { inviteSchema } from './client.schema';
import { zodResolver } from '@hookform/resolvers/zod';
import { MEMBERS_INTENT } from './constants';
import { Badge } from '@/components/ui/badge';

interface MembersClientProps {
  slug: string;
  members: OrgMemberWithUser[];
  invitations?: OrgInvitationWithInviter[];
  currentUserRole: OrgRole;
}

export function MembersClient({
  currentUserRole,
  invitations = [],
  members,
  slug,
}: MembersClientProps) {
  const isAdmin = currentUserRole === ORG_ROLES.ADMIN;
  const boundAction = membersAction.bind(null, { slug });
  const [state, formAction, isPending] = useActionState(boundAction, {});

  const form = useForm<z.infer<typeof inviteSchema>>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: '', role: ORG_ROLES.DEVELOPER },
  });

  return (
    <div className="space-y-6">
      {/* ── Invite form — admin only ─────────────────────────────── */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Invite a member</CardTitle>
          </CardHeader>
          <CardContent>
            {state.error && (
              <p className="text-sm text-destructive mb-3">{state.error}</p>
            )}
            {state.success && (
              <p className="text-sm text-green-600 mb-3">{state.success}</p>
            )}
            <form
              action={formAction}
              noValidate
              onSubmitCapture={async (e) => {
                const ok = await form.trigger(undefined, { shouldFocus: true });
                if (!ok) e.preventDefault();
              }}
              className="flex flex-col sm:flex-row gap-2"
            >
              <FieldGroup className="flex-1">
                <Controller
                  name="email"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <Input
                        {...field}
                        type="email"
                        placeholder="colleague@example.com"
                        aria-invalid={fieldState.invalid}
                      />
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />
              </FieldGroup>

              <Select name="role" defaultValue={ORG_ROLES.DEVELOPER}>
                <SelectTrigger className="w-full sm:w-36">
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ORG_ROLES.DEVELOPER}>Developer</SelectItem>
                  <SelectItem value={ORG_ROLES.ADMIN}>Admin</SelectItem>
                </SelectContent>
              </Select>

              <Button
                type="submit"
                name="intent"
                value={MEMBERS_INTENT.INVITE}
                disabled={isPending}
              >
                Send invite
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* ── Pending Invitations — admin only ───────────────────────── */}
      {isAdmin && invitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Pending Invitations ({invitations.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border">
            {invitations.map((invite) => (
              <div
                key={invite.id}
                className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
              >
                <div>
                  <p className="text-sm font-medium">{invite.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {invite.inviter?.name
                      ? `Invited by ${invite.inviter.name} • `
                      : ''}
                    Expires on {new Date(invite.expiresAt).toLocaleDateString()}
                  </p>
                </div>

                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="capitalize text-xs">
                      {invite.role}
                    </Badge>
                    <form action={formAction}>
                      <input
                        type="hidden"
                        name="invitationId"
                        value={invite.id}
                      />
                      <Button
                        type="submit"
                        name="intent"
                        value={MEMBERS_INTENT.REVOKE_INVITE}
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-destructive hover:text-destructive"
                        disabled={isPending}
                      >
                        Revoke
                      </Button>
                    </form>
                  </div>
                </div>
              ))}
          </CardContent>
        </Card>
      )}

      {/* ── Members list ─────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {members.length} {members.length === 1 ? 'member' : 'members'}
          </CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
            >
              <div className="flex items-center gap-3">
                <Avatar className="size-8">
                  <AvatarFallback>
                    {(member.user.name ?? member.user.email)
                      .charAt(0)
                      .toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">
                    {member.user.name ?? '—'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {member.user.email}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* role badge / selector */}
                {isAdmin ? (
                  <form action={formAction}>
                    <input type="hidden" name="memberId" value={member.id} />
                    <Select name="role" defaultValue={member.role}>
                      <SelectTrigger className="h-7 text-xs w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ORG_ROLES.ADMIN}>Admin</SelectItem>
                        <SelectItem value={ORG_ROLES.DEVELOPER}>
                          Developer
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      type="submit"
                      name="intent"
                      value={MEMBERS_INTENT.UPDATE_ROLE}
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs ml-1"
                      disabled={isPending}
                    >
                      Save
                    </Button>
                  </form>
                ) : (
                  <Badge variant="secondary" className="capitalize">
                    {member.role}
                  </Badge>
                )}

                {/* remove button — admin only */}
                {isAdmin && (
                  <form action={formAction}>
                    <input type="hidden" name="memberId" value={member.id} />
                    <Button
                      type="submit"
                      name="intent"
                      value={MEMBERS_INTENT.REMOVE}
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs text-destructive hover:text-destructive"
                      disabled={isPending}
                    >
                      Remove
                    </Button>
                  </form>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
