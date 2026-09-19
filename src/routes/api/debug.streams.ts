import { createFileRoute } from '@tanstack/react-router'

import { channelCount, listenerCount } from '#/server/events.ts'

/**
 * Dev-only diagnostics for the SSE leak check: open a stream, drop it, and
 * confirm the listener count returns to zero.
 *
 * A unit test cannot settle this -- whether cleanup actually runs depends on
 * the server runtime delivering abort or cancel.
 */
export const Route = createFileRoute('/api/debug/streams')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (process.env.NODE_ENV === 'production') {
          return new Response('Not found', { status: 404 })
        }

        const sessionId = new URL(request.url).searchParams.get('sessionId')

        return Response.json({
          channels: channelCount(),
          listeners: sessionId ? listenerCount(sessionId) : null,
        })
      },
    },
  },
})
