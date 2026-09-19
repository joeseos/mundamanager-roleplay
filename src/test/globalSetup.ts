import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Client, Pool } from 'pg'

import { resolveTestDatabaseUrl } from './dbUrl.ts'

/**
 * Creates the test database if it is missing and brings it up to the current
 * schema, so `npm test` is self-contained: no manual migrate step, and no
 * dependency on whatever state the development database happens to be in.
 */
export default async function setup() {
  const { testUrl, adminUrl, name } = resolveTestDatabaseUrl()

  const admin = new Client({ connectionString: adminUrl })
  await admin.connect()
  try {
    await admin.query(`create database "${name}"`)
  } catch (error) {
    // 42P04 is "database already exists", which is the normal case.
    if ((error as { code?: string }).code !== '42P04') throw error
  } finally {
    await admin.end()
  }

  const pool = new Pool({ connectionString: testUrl })
  try {
    await migrate(drizzle(pool), { migrationsFolder: './drizzle' })
  } finally {
    await pool.end()
  }
}
