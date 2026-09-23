import { ConflictException, NotFoundException } from '@nestjs/common';
import { and, count, eq } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import slugify from 'slugify';
import type { OAuthProfile, OAuthProvider } from '@orion-db/types';
import { DrizzleService } from '../db/drizzle.service';
import { oauthAccounts, orgMembers, organizations, users } from '../db/schema';
import type { User as DbUser } from '../db/schema/users';

type Db = DrizzleService['db'];

export interface OAuthUpsertResult {
  user: DbUser;
  isNewUser: boolean;
  isNewLink: boolean;
}

/**
 * Generates a unique-ish org slug, e.g. "jane-org-3f9a2c".
 * Exported so AuthService reuses the same convention for password signups.
 */
export function generateOrgSlug(name: string): string {
  const base = slugify(`${name}-org`, { lower: true, strict: true });
  const suffix = randomBytes(3).toString('hex');
  return `${base}-${suffix}`;
}

// lookups ---------------------------------------------------------------------

export async function findOAuthAccount(
  db: Db,
  provider: OAuthProvider,
  providerAccountId: string,
) {
  const [account] = await db
    .select()
    .from(oauthAccounts)
    .where(
      and(
        eq(oauthAccounts.provider, provider),
        eq(oauthAccounts.providerAccountId, providerAccountId),
      ),
    )
    .limit(1);
  return account;
}

export async function findOAuthLink(
  db: Db,
  userId: string,
  provider: OAuthProvider,
) {
  const [account] = await db
    .select()
    .from(oauthAccounts)
    .where(
      and(
        eq(oauthAccounts.userId, userId),
        eq(oauthAccounts.provider, provider),
      ),
    )
    .limit(1);
  return account;
}

// link / unlink ----------------------------------------------------------------

/**
 * Links a provider identity to a user. Idempotent for the same identity;
 * re-links (user, provider) to a new provider account id on re-consent.
 * Throws if the provider identity is already linked to a different user.
 */
export async function linkOAuthAccount(
  db: Db,
  userId: string,
  profile: OAuthProfile,
): Promise<OAuthUpsertResult['user']> {
  const existingIdentity = await findOAuthAccount(
    db,
    profile.provider,
    profile.providerAccountId,
  );

  if (existingIdentity) {
    if (existingIdentity.userId !== userId) {
      throw new ConflictException(
        `${profile.provider} account is already linked to another user`,
      );
    }
    // already linked to this exact user — nothing to do
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return user;
  }

  const [account] = await db
    .insert(oauthAccounts)
    .values({
      provider: profile.provider,
      providerAccountId: profile.providerAccountId,
      userId,
    })
    // handles switching the linked provider account for this (user, provider)
    .onConflictDoUpdate({
      target: [oauthAccounts.userId, oauthAccounts.provider],
      set: {
        providerAccountId: profile.providerAccountId,
        updatedAt: new Date(),
      },
    })
    .returning();

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return user;
}

/**
 * Removes a provider link. Refuses if it would leave the account with no way
 * to sign in (no password set and this is the only linked provider).
 */
export async function unlinkOAuthAccount(
  db: Db,
  userId: string,
  provider: OAuthProvider,
): Promise<void> {
  const link = await findOAuthLink(db, userId, provider);
  if (!link) {
    throw new NotFoundException(`No ${provider} account linked to this user`);
  }

  const [user] = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) {
    throw new NotFoundException('User not found');
  }

  if (!user.passwordHash) {
    const [{ total }] = await db
      .select({ total: count() })
      .from(oauthAccounts)
      .where(eq(oauthAccounts.userId, userId));
    if (total <= 1) {
      throw new ConflictException('Cannot unlink the last sign-in method');
    }
  }

  await db.delete(oauthAccounts).where(eq(oauthAccounts.id, link.id));
}

// upsert ------------------------------------------------------------------------

/**
 * Upserts a user from an OAuth profile and returns the linked user.
 *
 * 1. Provider identity already known → return that user (returning login).
 * 2. Verified provider email matches an existing user → link identity to them.
 * 3. No match → create user (no password), default org + admin membership, link.
 */
export async function upsertOAuthUser(
  db: Db,
  profile: OAuthProfile,
  opts: { generateOrgSlug?: (name: string) => string } = {},
): Promise<OAuthUpsertResult> {
  const generateSlug = opts.generateOrgSlug ?? generateOrgSlug;
  const email = profile.email.toLowerCase();

  // 1. returning user — match on provider identity
  const existingAccount = await findOAuthAccount(
    db,
    profile.provider,
    profile.providerAccountId,
  );
  if (existingAccount) {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, existingAccount.userId))
      .limit(1);
    if (user) {
      return { user, isNewUser: false, isNewLink: false };
    }
    // orphaned link (user was deleted) — clean up and fall through
    await db
      .delete(oauthAccounts)
      .where(eq(oauthAccounts.id, existingAccount.id));
  }

  // 2. match by verified email and link
  const [existingUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existingUser) {
    // don't silently hijack an existing (user, provider) link that points at
    // a different provider account id
    const link = await findOAuthLink(db, existingUser.id, profile.provider);
    if (link && link.providerAccountId !== profile.providerAccountId) {
      throw new ConflictException(
        `Account already linked with a different ${profile.provider} account`,
      );
    }
    await linkOAuthAccount(db, existingUser.id, profile);
    return { user: existingUser, isNewUser: false, isNewLink: !link };
  }

  // 3. brand-new user
  const [user] = await db
    .insert(users)
    .values({
      email,
      name: profile.name ?? email.split('@')[0],
      avatarUrl: profile.avatarUrl ?? null,
    })
    .returning();

  const [org] = await db
    .insert(organizations)
    .values({
      name: `${user.name}'s Org`,
      slug: generateSlug(user.name),
    })
    .returning();

  await db.insert(orgMembers).values({
    orgId: org.id,
    userId: user.id,
    role: 'admin',
  });

  await linkOAuthAccount(db, user.id, profile);

  return { user, isNewUser: true, isNewLink: true };
}
