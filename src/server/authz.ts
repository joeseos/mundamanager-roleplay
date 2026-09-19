import { and, eq } from 'drizzle-orm'

import { db } from '#/db/index.ts'
import { characters, sessions, tableMembers } from '#/db/schema.ts'
import type { Character, TableRole } from '#/db/schema.ts'

import { HttpError } from './middleware.ts'
import type { AppUser } from './middleware.ts'

/**
 * A caller's proven standing on one table.
 *
 * Every read and every mutation in this app goes through a function in this
 * module to obtain one of these. Routes and server functions never query
 * `table_members` themselves, so the rule below lives in exactly one place:
 *
 *   An Arbitrator sees everything on their table.
 *   A player sees their own character plus party-level state.
 *
 * Party state (credits, loot, contacts) and the session event log are shared
 * by the whole table -- they are the party's, not a sum of the characters.
 */
export interface TableAccess {
  userId: string
  tableId: string
  role: TableRole
}

export interface SessionAccess extends TableAccess {
  sessionId: string
}

export function isArbitrator(access: TableAccess): boolean {
  return access.role === 'arbitrator'
}

/** Throws 404 rather than 403 for non-members: a stranger learns nothing. */
export async function requireTableAccess(
  user: AppUser,
  tableId: string,
): Promise<TableAccess> {
  const [membership] = await db
    .select({ role: tableMembers.role })
    .from(tableMembers)
    .where(and(eq(tableMembers.tableId, tableId), eq(tableMembers.userId, user.id)))
    .limit(1)

  if (!membership) {
    throw new HttpError(404, 'Table not found')
  }

  return { userId: user.id, tableId, role: membership.role }
}

export async function requireArbitrator(
  user: AppUser,
  tableId: string,
): Promise<TableAccess> {
  const access = await requireTableAccess(user, tableId)
  if (!isArbitrator(access)) {
    throw new HttpError(403, 'Only the Arbitrator can do that')
  }
  return access
}

export async function requireSessionAccess(
  user: AppUser,
  sessionId: string,
): Promise<SessionAccess> {
  const [session] = await db
    .select({ tableId: sessions.tableId })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1)

  if (!session) {
    throw new HttpError(404, 'Session not found')
  }

  const access = await requireTableAccess(user, session.tableId)
  return { ...access, sessionId }
}

export function canSeeCharacter(
  access: TableAccess,
  character: Pick<Character, 'tableId' | 'ownerUserId'>,
): boolean {
  if (character.tableId !== access.tableId) return false
  return isArbitrator(access) || character.ownerUserId === access.userId
}

export function assertCanEditCharacter(
  access: TableAccess,
  character: Pick<Character, 'tableId' | 'ownerUserId'>,
): void {
  // Editing is narrower than seeing: an Arbitrator can read every sheet on
  // their table, but a character belongs to its owner.
  if (
    character.tableId !== access.tableId ||
    character.ownerUserId !== access.userId
  ) {
    throw new HttpError(403, 'That character belongs to someone else')
  }
}

/** The characters this caller is allowed to see, filtered in the query. */
export async function visibleCharacters(
  access: TableAccess,
): Promise<Array<Character>> {
  const scope = isArbitrator(access)
    ? eq(characters.tableId, access.tableId)
    : and(
        eq(characters.tableId, access.tableId),
        eq(characters.ownerUserId, access.userId),
      )

  return db.select().from(characters).where(scope).orderBy(characters.name)
}
