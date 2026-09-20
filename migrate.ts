import { migrate } from 'drizzle-orm/node-postgres/migrator'

import { db, pool } from './src/db/index.ts'

/**
 * Runs at container start, before the server listens (see the Dockerfile CMD).
 * Single instance by design, so no migration locking is needed.
 *
 * This uses the programmatic migrator rather than `drizzle-kit migrate` so the
 * production image needs only drizzle-orm -- no drizzle-kit, no esbuild, no
 * drizzle.config.ts. It reads the same ./drizzle folder and writes the same
 * __drizzle_migrations journal table, so `npm run db:migrate` locally and this
 * are interchangeable.
 */
function describeTarget(): string {
  const raw = process.env.DATABASE_URL
  if (!raw) return 'unknown host'
  try {
    const url = new URL(raw)
    // Host and database only -- never the credentials.
    return `${url.hostname}:${url.port || '5432'}${url.pathname}`
  } catch {
    return 'an unparseable DATABASE_URL'
  }
}

try {
  await migrate(db, { migrationsFolder: './drizzle' })
  console.log('migrations applied')
} catch (error) {
  // The container exits here and the orchestrator restarts it, so this line
  // is the only thing that explains a crash loop. Make it say which database
  // could not be reached rather than printing a bare query stack.
  console.error(
    `Migration failed against ${describeTarget()}. ` +
      'Check that DATABASE_URL points at the internal hostname of a reachable ' +
      'Postgres and that both are on the same network.',
  )
  console.error(error)
  await pool.end().catch(() => {})
  process.exit(1)
}

await pool.end()
