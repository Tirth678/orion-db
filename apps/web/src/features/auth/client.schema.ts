import { z } from 'zod';
import type { LoginInput, RegisterInput } from '@orion-db/types';

export const loginSchema = z.object({
    email: z.string().email('Invalid email'),
    password: z.string().min(1, 'Password is required'),
}) satisfies z.ZodType<LoginInput>

export const registerSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    email: z.string().email('Invalid email'),
    password: z.string().min(8, 'Password must be of 8 characters')
}) satisfies z.ZodType<RegisterInput>