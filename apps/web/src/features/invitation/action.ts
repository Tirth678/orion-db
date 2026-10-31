'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { applyAuthCookiesFromResponse } from '@/features/auth/cookies';

const acceptInviteSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  name: z.string().optional(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .optional()
    .or(z.literal('')),
});

export type AcceptInviteActionState = {
  error?: string;
};

export async function acceptInviteAction(
  _prev: AcceptInviteActionState,
  formData: FormData,
): Promise<AcceptInviteActionState> {
  const raw = Object.fromEntries(formData);
  const parsed = acceptInviteSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      error: parsed.error.flatten().formErrors[0] ?? 'Invalid input',
    };
  }

  const { token, name, password } = parsed.data;

  try {
    const res = await fetch(`${process.env.API_URL}/auth/invite/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        name: name?.trim() || undefined,
        password: password?.trim() || undefined,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return {
        error: body.message ?? 'Failed to accept invitation',
      };
    }

    await applyAuthCookiesFromResponse(res);
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Something went wrong',
    };
  }

  redirect('/dashboard');
}
