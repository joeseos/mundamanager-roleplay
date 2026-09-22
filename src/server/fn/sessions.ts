import { createServerFn } from '@tanstack/react-start'
import { eq, sql } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/db/index.ts'
import { sessions, tables } from '#/db/schema.ts'
import { appendSessionEvent } from '#/server/appendEvent.ts'
import { requireArbitrator, requireSessionAccess } from '#/server/authz.ts'
import { HttpError, requireUser } from '#/server/middleware.ts'
import { readActorNames, readEventsSince } from '#/server/sessionLog.ts'

/** Long enough to cover a whole sitting; the stream carries everything after it. */
const SESSION_LOG_TAIL = 500

export const startSession = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      tableId: z.uuid(),
      title: z.string().trim().min(1).max(120),
    }),
  )
  .handler(async ({ context, data }) => {
    const user = requireUser(context)
    await requireArbitrator(user, data.tableId)

    const [row] = await db
      .insert(sessions)
      .values({ tableId: data.tableId, title: data.title })
      .returning()

    return row!
  })

export const endSession = createServerFn({ method: 'POST' })
  .validator(z.object({ sessionId: z.uuid() }))
  .handler(async ({ context, data }) => {
    const user = requireUser(context)
    const access = await requireSessionAccess(user, data.sessionId)
    await requireArbitrator(user, access.tableId)

    // The status change is derived state, so it commits with its log row.
    return appendSessionEvent(
      { sessionId: data.sessionId, type: 'session.ended', actorUserId: user.id },
      async (tx) => {
        await tx
          .update(sessions)
          .set({ status: 'ended', endedAt: new Date() })
          .where(eq(sessions.id, data.sessionId))
      },
    )
  })

export const getSessionDetail = createServerFn({ method: 'GET' })
  .validator(z.object({ sessionId: z.uuid() }))
  .handler(async ({ context, data }) => {
    const user = requireUser(context)
    const access = await requireSessionAccess(user, data.sessionId)

    const [session] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, data.sessionId))
      .limit(1)

    if (!session) throw new HttpError(404, 'Session not found')

    const [table] = await db
      .select({ name: tables.name, partyCredits: tables.partyCredits })
      .from(tables)
      .where(eq(tables.id, access.tableId))
      .limit(1)

    const [events, actorNames] = await Promise.all([
      readEventsSince(data.sessionId, 0, SESSION_LOG_TAIL),
      readActorNames(access.tableId),
    ])

    return {
      session,
      table: table!,
      role: access.role,
      events,
      actorNames,
    }
  })

export const postSessionEvent = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      sessionId: z.uuid(),
      // Only one event type exists so far. Adding another is one line here
      // plus a case in the session log renderer -- no schema change.
      type: z.enum(['note']),
      payload: z.object({ text: z.string().trim().min(1).max(2000) }),
    }),
  )
  .handler(async ({ context, data }) => {
    const user = requireUser(context)
    await requireSessionAccess(user, data.sessionId)

    return appendSessionEvent({
      sessionId: data.sessionId,
      type: data.type,
      payload: data.payload,
      actorUserId: user.id,
    })
  })

/**
 * Party credits are table-level shared state, so changing them is a derived
 * write that has to commit with its log row -- the case appendSessionEvent's
 * `derive` callback exists for.
 */
export const adjustPartyCredits = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      sessionId: z.uuid(),
      delta: z.number().int().min(-100_000).max(100_000),
    }),
  )
  .handler(async ({ context, data }) => {
    const user = requireUser(context)
    const access = await requireSessionAccess(user, data.sessionId)
    await requireArbitrator(user, access.tableId)

    return appendSessionEvent(
      {
        sessionId: data.sessionId,
        type: 'party.credits',
        payload: { delta: data.delta },
        actorUserId: user.id,
      },
      async (tx) => {
        await tx
          .update(tables)
          .set({ partyCredits: sql`${tables.partyCredits} + ${data.delta}` })
          .where(eq(tables.id, access.tableId))
      },
    )
  })
