import {
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from './users';

export const oauthAccounts = pgTable(
  'oauth_accounts',
  {
    id: uuid().defaultRandom().primaryKey(),
    provider: text('provider').notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('oauth_accounts_provider_account_id_uq').on(
      table.provider,
      table.providerAccountId,
    ),
    // one link per (user, provider); re-consent updates the same row
    uniqueIndex('oauth_accounts_user_provider_uq').on(
      table.userId,
      table.provider,
    ),
  ],
);

export type OAuthAccount = typeof oauthAccounts.$inferSelect;
export type NewOAuthAccount = typeof oauthAccounts.$inferInsert;
