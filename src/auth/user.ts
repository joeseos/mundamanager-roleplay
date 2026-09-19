import { eq } from 'drizzle-orm'

import { db } from '#/db/index.ts'
import { users } from '#/db/schema.ts'
import type { User } from '#/db/schema.ts'

import type { VerifiedIdentity } from './verify.ts'

/**
 * Creates the local account on first login, or refreshes only the email on
 * later logins.
 *
 * `displayName` and `avatarUrl` are deliberately absent from the update set:
 * they are seeded once from the token and owned locally from then on, so a
 * rename in the other app never overwrites what the player chose here.
 */
export async function upsertUserFromIdentity(
  identity: VerifiedIdentity,
): Promise<User> {
  const seedName =
    identity.displayName ?? identity.email.split('@')[0] ?? identity.email

  const [row] = await db
    .insert(users)
    .values({
      supabaseUserId: identity.supabaseUserId,
      email: identity.email,
      displayName: seedName,
      avatarUrl: identity.avatarUrl,
    })
    .onConflictDoUpdate({
      target: users.supabaseUserId,
      set: { email: identity.email },
    })
    .returning()

  return row!
}

export async function findUserBySupabaseId(
  supabaseUserId: string,
): Promise<User | null> {
  const [row] = await db
    .select()
    .from(users)
    .where(eq(users.supabaseUserId, supabaseUserId))
    .limit(1)

  return row ?? null
}
