import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from './users';

export const orgRoleEnum = pgEnum('org_role', ['admin', 'developer']);

export const orgInviteStatusEnum = pgEnum('org_invite_status', [
  'pending',
  'accepted',
  'revoked',
  'expired',
]);

export const organizations = pgTable('organizations', {
  id: uuid().defaultRandom().primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const orgMembers = pgTable('org_members', {
  id: uuid().defaultRandom().primaryKey(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  role: orgRoleEnum('role').notNull().default('developer'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  removedAt: timestamp('removed_at'),
});

export const orgInvitations = pgTable(
  'org_invitations',
  {
    id: uuid().defaultRandom().primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    role: orgRoleEnum('role').notNull().default('developer'),
    tokenHash: text('token_hash').notNull(),
    invitedBy: uuid('invited_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    status: orgInviteStatusEnum('status').notNull().default('pending'),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    acceptedAt: timestamp('accepted_at'),
  },
  (table) => [
    index('org_invitations_org_id_idx').on(table.orgId),
    index('org_invitations_token_hash_idx').on(table.tokenHash),
    index('org_invitations_email_idx').on(table.email),
  ],
);

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
export type OrgMember = typeof orgMembers.$inferSelect;
export type NewOrgMember = typeof orgMembers.$inferInsert;
export type OrgInvitation = typeof orgInvitations.$inferSelect;
export type NewOrgInvitation = typeof orgInvitations.$inferInsert;
