import { createFileRoute } from '@tanstack/react-router'

import type { SessionEvent } from '#/db/schema.ts'
import { requireSessionAccess } from '#/server/authz.ts'
import { subscribe } from '#/server/events.ts'
import { readEventsSince } from '#/server/sessionLog.ts'

const HEARTBEAT_MS = 20_000
const RECONNECT_MS = 3_000

/**
 * Hard cap on how long one stream stays open.
 *
 * The three cleanup triggers below cover a client that goes away visibly, but
 * not one that goes away silently. A page put into Chrome's back-forward cache
 * on navigation keeps its socket open: no abort, no cancel, and the heartbeat
 * still writes successfully into a socket nobody is reading. Measured: the
 * listener survives navigation indefinitely.
 *
 * Rather than trying to detect every disconnect path, every stream is retired
 * on a timer and the client reconnects. Replay-from-seq already makes a
 * reconnect invisible -- it is the same path a deploy takes -- so this costs
 * nothing and bounds any undetected leak to this interval instead of forever.
 */
const MAX_STREAM_MS = 5 * 60_000

/**
 * Where to resume from.
 *
 * EventSource resends the last `id:` it saw as Last-Event-ID automatically,
 * which is why every frame carries one. The `?since=` query parameter does
 * the same job explicitly, for a client that is not using EventSource.
 */
function resolveSince(request: Request): number {
  const header = Number.parseInt(request.headers.get('last-event-id') ?? '', 10)
  const query = Number.parseInt(
    new URL(request.url).searchParams.get('since') ?? '',
    10,
  )

  return Math.max(
    Number.isFinite(header) && header > 0 ? header : 0,
    Number.isFinite(query) && query > 0 ? query : 0,
  )
}

function frame(event: SessionEvent): string {
  const data = JSON.stringify({
    id: event.id,
    seq: event.seq,
    type: event.type,
    payload: event.payload,
    actorUserId: event.actorUserId,
    createdAt: event.createdAt.toISOString(),
  })
  // The id: line is what makes reconnect-with-replay work.
  return `id: ${event.seq}\ndata: ${data}\n\n`
}

export const Route = createFileRoute('/api/sessions/$sessionId/events')({
  server: {
    handlers: {
      GET: async ({ request, params, context }) => {
        // Authenticated by cookie, resolved by the same global middleware
        // every server function uses. EventSource cannot set an Authorization
        // header, which is the whole reason the token lives in a cookie.
        if (!context.user) {
          return new Response('Unauthorized', { status: 401 })
        }

        try {
          await requireSessionAccess(context.user, params.sessionId)
        } catch {
          // Deliberately opaque: a non-member learns nothing about whether
          // this session exists.
          return new Response('Not found', { status: 404 })
        }

        const sessionId = params.sessionId
        const since = resolveSince(request)
        const encoder = new TextEncoder()

        let teardown = () => {}

        const stream = new ReadableStream<Uint8Array>({
          async start(controller) {
            let closed = false
            let unsubscribe = () => {}
            let heartbeat: ReturnType<typeof setInterval> | undefined
            let lifetime: ReturnType<typeof setTimeout> | undefined

            // Idempotent: any combination of the triggers below can fire.
            const finish = () => {
              if (closed) return
              closed = true
              if (heartbeat) clearInterval(heartbeat)
              if (lifetime) clearTimeout(lifetime)
              unsubscribe()
              try {
                controller.close()
              } catch {
                // Already closed by the runtime. Nothing to do.
              }
            }
            teardown = finish

            const send = (chunk: string) => {
              if (closed) return
              try {
                controller.enqueue(encoder.encode(chunk))
              } catch {
                // Trigger 3: the consumer is gone and the controller rejects
                // writes. Covers the case where neither abort nor cancel
                // fires -- request.signal has a history of not firing here
                // (TanStack/router#3490), so no single trigger is trusted.
                finish()
              }
            }

            // Trigger 1: client disconnected.
            request.signal.addEventListener('abort', finish)

            // Flush something immediately. The server does not send response
            // headers until the first body byte, so without this the client
            // sees nothing at all until the first real event or the 20s
            // heartbeat -- and reports a hung connection meanwhile.
            //
            // `retry:` also sets the browser's own reconnect floor; our
            // backoff on the client sits on top of it.
            send(`retry: ${RECONNECT_MS}\n\n`)
            send(': connected\n\n')

            // Subscribe BEFORE replaying, buffering anything that arrives
            // meanwhile. Replaying first would drop an event that commits
            // between the query and the subscribe; this way nothing is lost,
            // and `seq` de-duplicates whatever the replay already covered.
            let replayed = false
            let highWater = since
            const pending: Array<SessionEvent> = []

            const deliver = (event: SessionEvent) => {
              if (event.seq <= highWater) return
              highWater = event.seq
              send(frame(event))
            }

            unsubscribe = subscribe(sessionId, (event) => {
              if (!replayed) {
                pending.push(event)
                return
              }
              deliver(event)
            })

            try {
              for (const event of await readEventsSince(sessionId, since)) {
                deliver(event)
              }
            } catch (error) {
              console.error('SSE replay failed', error)
              finish()
              return
            }

            replayed = true
            for (const event of pending) deliver(event)
            pending.length = 0

            // A named event rather than a `: ping` comment on purpose.
            // EventSource never surfaces comment lines to JavaScript, so a
            // comment heartbeat cannot drive a client-side liveness check --
            // and one is needed, because Chrome leaves readyState OPEN long
            // after the server has gone. This is observable, so the client can
            // notice silence and reconnect.
            heartbeat = setInterval(
              () => send('event: ping\ndata: {}\n\n'),
              HEARTBEAT_MS,
            )

            // Trigger 4, and the only one that does not depend on noticing
            // that the client has gone.
            lifetime = setTimeout(finish, MAX_STREAM_MS)
          },

          // Trigger 2: the consumer cancelled the stream.
          cancel() {
            teardown()
          },
        })

        return new Response(stream, {
          headers: {
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'private, no-cache, no-transform',
            Connection: 'keep-alive',
            // nginx-specific. Coolify fronts with Traefik, which does not
            // buffer, so this is belt-and-braces for other proxies.
            'X-Accel-Buffering': 'no',
          },
        })
      },
    },
  },
})
