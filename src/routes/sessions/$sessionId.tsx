import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useState } from 'react'

import { useBootstrap } from '#/client/bootstrap.ts'
import { useSessionStream } from '#/client/useSessionStream.ts'
import type { StreamEvent } from '#/client/useSessionStream.ts'
import {
  adjustPartyCredits,
  endSession,
  getSessionDetail,
  postSessionEvent,
} from '#/server/fn/sessions.ts'

export const Route = createFileRoute('/sessions/$sessionId')({
  loader: ({ params }) => getSessionDetail({ data: { sessionId: params.sessionId } }),
  component: SessionPage,
})

function SessionPage() {
  const { session, table, role, events: initialEvents, actorNames } =
    Route.useLoaderData()
  const { user } = useBootstrap()
  const router = useRouter()

  const { events, connected, reconcile } = useSessionStream(
    session.id,
    initialEvents.map(toStreamEvent),
  )

  const [text, setText] = useState('')
  const [pending, setPending] = useState<Array<string>>([])

  async function onPost(event: React.FormEvent) {
    event.preventDefault()
    const body = text.trim()
    if (!body) return

    setText('')
    // Optimistic: show it straight away, then reconcile against the server's
    // own echoed event rather than guessing its sequence number.
    setPending((p) => [...p, body])

    const saved = await postSessionEvent({
      data: { sessionId: session.id, type: 'note', payload: { text: body } },
    })

    setPending((p) => {
      const index = p.indexOf(body)
      return index === -1 ? p : [...p.slice(0, index), ...p.slice(index + 1)]
    })
    reconcile(toStreamEvent(saved))
  }

  async function onAdjustCredits(delta: number) {
    const saved = await adjustPartyCredits({ data: { sessionId: session.id, delta } })
    reconcile(toStreamEvent(saved))
    await router.invalidate()
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-8">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{session.title}</h1>
          <p className="text-sm text-stone-400">
            <Link to="/tables/$tableId" params={{ tableId: session.tableId }}>
              {table.name}
            </Link>
            {' · '}
            {session.status === 'ended' ? 'ended' : 'in progress'}
            {' · '}party credits {table.partyCredits}
          </p>
        </div>
        <span
          className={`rounded px-2 py-1 text-xs ${
            connected ? 'bg-emerald-900 text-emerald-200' : 'bg-stone-800 text-stone-400'
          }`}
        >
          {connected ? 'live' : 'reconnecting'}
        </span>
      </header>

      {role === 'arbitrator' && session.status !== 'ended' ? (
        <div className="flex gap-2 text-sm">
          <button
            type="button"
            onClick={() => onAdjustCredits(10)}
            className="rounded border border-stone-700 px-3 py-1 hover:bg-stone-900"
          >
            +10 credits
          </button>
          <button
            type="button"
            onClick={() => onAdjustCredits(-10)}
            className="rounded border border-stone-700 px-3 py-1 hover:bg-stone-900"
          >
            -10 credits
          </button>
          <button
            type="button"
            onClick={async () => {
              await endSession({ data: { sessionId: session.id } })
              await router.invalidate()
            }}
            className="rounded border border-stone-700 px-3 py-1 hover:bg-stone-900"
          >
            End session
          </button>
        </div>
      ) : null}

      <ol className="space-y-2">
        {events.map((event) => (
          <li
            key={event.id}
            className="rounded border border-stone-800 p-3 text-sm"
            data-seq={event.seq}
          >
            <div className="flex justify-between text-xs text-stone-500">
              <span>
                {event.actorUserId ? actorNames[event.actorUserId] ?? 'Someone' : 'System'}
              </span>
              <span>#{event.seq}</span>
            </div>
            <div className="mt-1">{describe(event)}</div>
          </li>
        ))}
        {pending.map((body, index) => (
          <li
            key={`pending-${index}`}
            className="rounded border border-dashed border-stone-700 p-3 text-sm opacity-60"
          >
            <div className="text-xs text-stone-500">{user?.displayName} · sending</div>
            <div className="mt-1">{body}</div>
          </li>
        ))}
        {events.length === 0 && pending.length === 0 ? (
          <li className="text-sm text-stone-400">Nothing has happened yet.</li>
        ) : null}
      </ol>

      {session.status === 'ended' ? (
        <p className="text-sm text-stone-400">This session has ended.</p>
      ) : (
        <form onSubmit={onPost} className="flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={2000}
            placeholder="Post to the log"
            className="flex-1 rounded border border-stone-700 bg-stone-900 px-3 py-2"
          />
          <button
            type="submit"
            className="rounded bg-amber-600 px-4 py-2 font-medium text-stone-950"
          >
            Post
          </button>
        </form>
      )}
    </main>
  )
}

function toStreamEvent(event: {
  id: string
  seq: number
  type: string
  payload: Record<string, unknown>
  actorUserId: string | null
  createdAt: string | Date
}): StreamEvent {
  return {
    ...event,
    createdAt:
      typeof event.createdAt === 'string'
        ? event.createdAt
        : event.createdAt.toISOString(),
  }
}

function describe(event: StreamEvent): string {
  switch (event.type) {
    case 'note':
      return String(event.payload.text ?? '')
    case 'party.credits': {
      const delta = Number(event.payload.delta ?? 0)
      return `Party credits ${delta >= 0 ? '+' : ''}${delta}`
    }
    case 'session.ended':
      return 'Session ended'
    default:
      return event.type
  }
}
