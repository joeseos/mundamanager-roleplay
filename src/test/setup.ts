import { existsSync } from 'node:fs'

// CI supplies DATABASE_URL from the Postgres service; locally it comes from
// .env.local, which is not committed.
if (existsSync('.env.local')) {
  process.loadEnvFile('.env.local')
}
