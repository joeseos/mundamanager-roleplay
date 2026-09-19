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
await migrate(db, { migrationsFolder: './drizzle' })
console.log('migrations applied')
await pool.end()
