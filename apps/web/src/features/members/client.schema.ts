import { z } from 'zod';
import { ORG_ROLES } from '@orion/constants';
import type { InviteMemberInput, UpdateRoleInput } from '@orion/types';

export const inviteSchema = z.object({
  email: z.string().email('Invalid email'),
  role: z.enum([ORG_ROLES.ADMIN, ORG_ROLES.DEVELOPER]).optional(),
}) satisfies z.ZodType<InviteMemberInput>;

export const updateRoleSchema = z.object({
  role: z.enum([ORG_ROLES.ADMIN, ORG_ROLES.DEVELOPER]),
}) satisfies z.ZodType<UpdateRoleInput>;
