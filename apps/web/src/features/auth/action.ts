'use server'

import { redirect } from 'next/navigation';
import { authServerSchema } from './server.schema';
import { AUTH_INTENT } from './constants';

export type AuthActionState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string[]>;
};

export async function authAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const raw = Object.fromEntries(formData);
  const parsed = authServerSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const { intent, ...data } = parsed.data;

  let res: Response;

  switch (intent) {
    case AUTH_INTENT.LOGIN: {
      res = await fetch(`${process.env.API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      break;
    }
    case AUTH_INTENT.REGISTER: {
      res = await fetch(`${process.env.API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      break;
    }
    default: {
      return { error: 'Invalid intent' };
    }
  }

  if (!res.ok) {
    const body = await res.json();
    return { error: body.message ?? 'Request failed' };
  }

  // Temporary: show success message instead of redirecting to non-existent dashboard
  if (intent === AUTH_INTENT.REGISTER) {
    return { 
      error: undefined,
      fieldErrors: undefined,
      success: 'User added to database successfully!' 
    };
  }

  redirect('/dashboard');
}