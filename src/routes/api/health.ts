import { createFileRoute } from '@tanstack/react-router'
import { sql } from 'drizzle-orm'

import { db } from '#/db/index.ts'
import { PRIVATE } from '#/server/cacheHeaders.ts'

/**
 * Wired to Coolify's healthcheck.
 *
 * Migrations run in a separate process before the server starts listening, so
 * a server that can answer this at all has already applied them. That leaves
 * only "does the database respond".
 */
export const Route = createFileRoute('/api/health')({
  server: {
    handlers: {
      GET: async () => {
        try {
          await db.execute(sql`select 1`)
          return Response.json({ status: 'ok' }, { headers: PRIVATE })
        } catch (error) {
          console.error('healthcheck failed', error)
          return Response.json(
            { status: 'database unavailable' },
            { status: 503, headers: PRIVATE },
          )
        }
      },
    },
  },
})
