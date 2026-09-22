import { and, asc, desc, eq, gt } from 'drizzle-orm'

import { db } from '#/db/index.ts'
import { sessionEvents, tableMembers, users } from '#/db/schema.ts'
import type { SessionEvent } from '#/db/schema.ts'

/**
 * Reads behind the session page and the SSE stream.
 *
 * Lives outside src/server/fn/ on purpose. A module that defines server
 * functions must export *only* server functions: Start strips server function
 * implementations from the client bundle, but any other export forces the
 * whole module -- and here its `pg` import -- into the browser, where it
 * crashes on `Buffer is not defined` and hydration never happens.
 */

/**
 * Replay a session's log from an exclusive lower bound.
 *
 * `limit` takes the newest N instead of the whole log, still oldest-first so
 * the caller can keep appending. The stream replays without it, because a
 * reconnect must not skip anything between `since` and now.
 */
export async function readEventsSince(
  sessionId: string,
  since: number,
  limit?: number,
): Promise<Array<SessionEvent>> {
  const scope = and(
    eq(sessionEvents.sessionId, sessionId),
    gt(sessionEvents.seq, since),
  )

  if (limit === undefined) {
    return db.select().from(sessionEvents).where(scope).orderBy(asc(sessionEvents.seq))
  }

  const newest = await db
    .select()
    .from(sessionEvents)
    .where(scope)
    .orderBy(desc(sessionEvents.seq))
    .limit(limit)

  return newest.reverse()
}

/** The display names a table's own members are allowed to resolve. */
export async function readActorNames(
  tableId: string,
): Promise<Record<string, string>> {
  const rows = await db
    .select({ id: users.id, displayName: users.displayName })
    .from(tableMembers)
    .innerJoin(users, eq(users.id, tableMembers.userId))
    .where(eq(tableMembers.tableId, tableId))

  return Object.fromEntries(rows.map((row) => [row.id, row.displayName]))
}
