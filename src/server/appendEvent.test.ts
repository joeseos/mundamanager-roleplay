import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { db } from '#/db/index.ts'
import { characters, sessionEvents, sessions } from '#/db/schema.ts'
import { makeCharacter, makeTable, makeUser, resetDb } from '#/test/db.ts'
import type { Table, User } from '#/db/schema.ts'

import { appendSessionEvent } from './appendEvent.ts'
import { listenerCount, subscribe } from './events.ts'

let gm: User
let table: Table
let sessionId: string

beforeEach(async () => {
  await resetDb()
  gm = await makeUser('Arbitrator')
  table = await makeTable(gm)
  const [row] = await db
    .insert(sessions)
    .values({ tableId: table.id, title: 'Session One' })
    .returning()
  sessionId = row!.id
})

describe('appendSessionEvent', () => {
  it('allocates sequence numbers from 1 upward', async () => {
    const first = await appendSessionEvent({
      sessionId,
      type: 'note',
      actorUserId: gm.id,
    })
    const second = await appendSessionEvent({
      sessionId,
      type: 'note',
      actorUserId: gm.id,
    })

    expect(first.seq).toBe(1)
    expect(second.seq).toBe(2)
  })

  it('emits to subscribers after the write', async () => {
    const received: Array<number> = []
    const unsub = subscribe(sessionId, (e) => received.push(e.seq))

    await appendSessionEvent({ sessionId, type: 'note', actorUserId: gm.id })

    expect(received).toEqual([1])
    unsub()
  })

  /**
   * The rule the whole module exists for: a rollback must not leave connected
   * clients showing state that was never committed.
   */
  it('emits nothing when the derived write fails', async () => {
    const listener = vi.fn()
    const unsub = subscribe(sessionId, listener)

    await expect(
      appendSessionEvent({ sessionId, type: 'note', actorUserId: gm.id }, async () => {
        throw new Error('derived write failed')
      }),
    ).rejects.toThrow('derived write failed')

    expect(listener).not.toHaveBeenCalled()

    // And nothing was persisted, including the sequence number.
    const rows = await db
      .select()
      .from(sessionEvents)
      .where(eq(sessionEvents.sessionId, sessionId))
    expect(rows).toHaveLength(0)

    const [session] = await db
      .select({ nextSeq: sessions.nextSeq })
      .from(sessions)
      .where(eq(sessions.id, sessionId))
    expect(session!.nextSeq).toBe(1)

    unsub()
  })

  it('commits derived state atomically with the log row', async () => {
    const character = await makeCharacter(table, gm, 'Kal')

    const event = await appendSessionEvent(
      { sessionId, type: 'character.renamed', payload: { to: 'Kal Jerico' }, actorUserId: gm.id },
      async (tx) => {
        await tx
          .update(characters)
          .set({ name: 'Kal Jerico' })
          .where(eq(characters.id, character.id))
      },
    )

    const [updated] = await db
      .select()
      .from(characters)
      .where(eq(characters.id, character.id))

    expect(updated!.name).toBe('Kal Jerico')
    expect(event.payload).toEqual({ to: 'Kal Jerico' })
  })

  /**
   * Concurrent appends must not collide on (session_id, seq). The counter is
   * incremented inside the transaction, so the row lock serialises them.
   */
  it('produces gapless distinct sequence numbers under concurrency', async () => {
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        appendSessionEvent({
          sessionId,
          type: 'note',
          payload: { i },
          actorUserId: gm.id,
        }),
      ),
    )

    const seqs = results.map((r) => r.seq).sort((a, b) => a - b)
    expect(seqs).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })

  it('rejects an append to a session that does not exist', async () => {
    await expect(
      appendSessionEvent({
        sessionId: '00000000-0000-0000-0000-000000000000',
        type: 'note',
        actorUserId: gm.id,
      }),
    ).rejects.toMatchObject({ status: 404 })

    expect(listenerCount(sessionId)).toBe(0)
  })
})
