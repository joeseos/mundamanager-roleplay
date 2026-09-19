import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

import * as schema from './schema.ts'

function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. Copy .env.example to .env.local for local development.',
    )
  }
  return url
}

/**
 * One pool for the process. Single instance by design -- no multi-instance
 * support, so there is no connection-count coordination to worry about.
 */
export const pool = new Pool({ connectionString: requireDatabaseUrl(), max: 10 })

export const db = drizzle(pool, { schema })

export type Db = typeof db
