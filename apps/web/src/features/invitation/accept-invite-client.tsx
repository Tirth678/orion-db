'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Field,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { acceptInviteAction } from './action';

export interface InviteVerificationData {
  valid: boolean;
  email: string;
  orgName: string;
  role: string;
  userExists: boolean;
  hasPassword?: boolean;
}

interface AcceptInviteClientProps {
  token: string;
  verification: InviteVerificationData;
}

export function AcceptInviteClient({
  token,
  verification,
}: AcceptInviteClientProps) {
  const [state, formAction, isPending] = useActionState(acceptInviteAction, {});
  const needsPassword = !verification.userExists || !verification.hasPassword;

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 px-4 py-12">
      <Card className="w-full max-w-md shadow-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex items-center justify-center size-12 rounded-full bg-primary/10 text-primary font-bold text-lg">
            {verification.orgName.charAt(0).toUpperCase()}
          </div>
          <CardTitle className="text-xl">
            Join {verification.orgName}
          </CardTitle>
          <CardDescription>
            You have been invited to collaborate as{' '}
            <Badge variant="outline" className="capitalize inline-block">
              {verification.role}
            </Badge>
          </CardDescription>
        </CardHeader>

        <CardContent>
          {state.error && (
            <div className="bg-destructive/10 text-destructive text-sm rounded-lg px-4 py-3 mb-4">
              {state.error}
            </div>
          )}

          <div className="bg-muted/50 rounded-lg p-3 text-sm mb-4">
            <span className="text-muted-foreground">Invited email: </span>
            <span className="font-medium text-foreground">
              {verification.email}
            </span>
          </div>

          <form action={formAction} className="space-y-4">
            <input type="hidden" name="token" value={token} />

            {needsPassword ? (
              <FieldGroup className="space-y-3">
                <Field>
                  <FieldLabel htmlFor="name">Your Name</FieldLabel>
                  <Input
                    id="name"
                    name="name"
                    type="text"
                    placeholder="Alex Doe"
                    autoComplete="name"
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="password">Create Password</FieldLabel>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    placeholder="••••••••"
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Must be at least 8 characters.
                  </p>
                </Field>
              </FieldGroup>
            ) : (
              <p className="text-sm text-muted-foreground">
                You already have an Orion account. Click below to accept the invitation and enter the workspace.
              </p>
            )}

            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending
                ? 'Joining...'
                : needsPassword
                  ? 'Accept & Create Account'
                  : 'Accept & Join Workspace'}
            </Button>
          </form>

          <div className="mt-6 text-center text-xs text-muted-foreground">
            Already have an account under a different email?{' '}
            <Link href="/login" className="text-primary hover:underline font-medium">
              Log in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

