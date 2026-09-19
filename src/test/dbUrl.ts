import { existsSync } from 'node:fs'

/**
 * Tests truncate between cases, so they must never point at the database
 * someone is developing against. This derives a sibling `<name>_test`
 * database from DATABASE_URL and is applied in both the global setup and
 * every worker, so there is no configuration to forget.
 */
export function resolveTestDatabaseUrl(): { testUrl: string; adminUrl: string; name: string } {
  if (existsSync('.env.local')) {
    process.loadEnvFile('.env.local')
  }

  const raw = process.env.DATABASE_URL
  if (!raw) {
    throw new Error('DATABASE_URL must be set to run the tests')
  }

  const url = new URL(raw)
  const name = url.pathname.slice(1)
  const testName = name.endsWith('_test') ? name : `${name}_test`

  url.pathname = `/${testName}`
  const testUrl = url.toString()

  // Creating a database requires connecting to a different one.
  url.pathname = '/postgres'

  return { testUrl, adminUrl: url.toString(), name: testName }
}
