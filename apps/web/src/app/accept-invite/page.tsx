import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  AcceptInviteClient,
  type InviteVerificationData,
} from '@/features/invitation/accept-invite-client';

async function verifyInviteToken(token: string): Promise<{
  data?: InviteVerificationData;
  error?: string;
}> {
  try {
    const res = await fetch(
      `${process.env.API_URL}/auth/invite/verify?token=${encodeURIComponent(token)}`,
      { cache: 'no-store' },
    );

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return {
        error:
          data.message || 'This invitation link is invalid or has expired.',
      };
    }

    const data: InviteVerificationData = await res.json();
    return { data };
  } catch {
    return {
      error:
        'Unable to verify invitation. Please check your connection and try again.',
    };
  }
}

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return <InvalidInviteMessage message="Missing invitation token." />;
  }

  const result = await verifyInviteToken(token);

  if (result.error || !result.data) {
    return (
      <InvalidInviteMessage
        message={
          result.error || 'This invitation link is invalid or has expired.'
        }
      />
    );
  }

  return <AcceptInviteClient token={token} verification={result.data} />;
}

function InvalidInviteMessage({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 px-4 py-12">
      <Card className="w-full max-w-md shadow-sm text-center">
        <CardHeader>
          <div className="mx-auto mb-2 flex items-center justify-center size-12 rounded-full bg-destructive/10 text-destructive text-xl font-bold">
            !
          </div>
          <CardTitle className="text-xl">Invitation Unavailable</CardTitle>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            If you believe this is an error, please ask your organization admin
            to send you a new invitation link.
          </p>
          <Button asChild className="w-full">
            <Link href="/login">Return to Login</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
