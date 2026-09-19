import { and, asc, eq, gt } from 'drizzle-orm'

import { db } from '#/db/index.ts'
import { sessionEvents } from '#/db/schema.ts'
import type { SessionEvent } from '#/db/schema.ts'

/**
 * Replay a session's log from an exclusive lower bound.
 *
 * Lives outside src/server/fn/ on purpose. A module that defines server
 * functions must export *only* server functions: Start strips server function
 * implementations from the client bundle, but any other export forces the
 * whole module -- and here its `pg` import -- into the browser, where it
 * crashes on `Buffer is not defined` and hydration never happens.
 */
export async function readEventsSince(
  sessionId: string,
  since: number,
): Promise<Array<SessionEvent>> {
  return db
    .select()
    .from(sessionEvents)
    .where(and(eq(sessionEvents.sessionId, sessionId), gt(sessionEvents.seq, since)))
    .orderBy(asc(sessionEvents.seq))
}
