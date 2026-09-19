import { eq, sql } from 'drizzle-orm'

import { db } from '#/db/index.ts'
import { sessionEvents, sessions } from '#/db/schema.ts'
import type { JsonValue, SessionEvent } from '#/db/schema.ts'

import { emit } from './events.ts'
import { HttpError } from './middleware.ts'

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

export interface AppendEventInput {
  sessionId: string
  type: string
  payload?: Record<string, JsonValue>
  actorUserId: string | null
}

/**
 * The commit boundary for everything that changes session state.
 *
 * Writes the caller's derived state and the session_events row in one
 * transaction, then emits to subscribers only once that transaction has
 * committed. Emitting inside the transaction would let a rollback leave every
 * connected client showing state that does not exist.
 *
 * `derive` is where a mutation's own writes go, so they land atomically with
 * the log row. The log is for history, replay and transport -- derived state
 * lives in the normal tables. This is not event sourcing.
 */
export async function appendSessionEvent(
  input: AppendEventInput,
  derive?: (tx: Transaction) => Promise<void>,
): Promise<SessionEvent> {
  const event = await db.transaction(async (tx) => {
    // Allocating the sequence number by incrementing a counter on the session
    // row takes a row lock, which serialises concurrent appends for this
    // session. RETURNING sees the new value, so `next_seq - 1` is the number
    // this append gets. The unique on (session_id, seq) backs it up.
    const [allocated] = await tx
      .update(sessions)
      .set({ nextSeq: sql`${sessions.nextSeq} + 1` })
      .where(eq(sessions.id, input.sessionId))
      .returning({ seq: sql<number>`${sessions.nextSeq} - 1` })

    if (!allocated) {
      throw new HttpError(404, 'Session not found')
    }

    await derive?.(tx)

    const [row] = await tx
      .insert(sessionEvents)
      .values({
        sessionId: input.sessionId,
        seq: allocated.seq,
        type: input.type,
        payload: input.payload ?? {},
        actorUserId: input.actorUserId,
      })
      .returning()

    return row!
  })

  // After commit, never inside.
  emit(event.sessionId, event)

  return event
}
