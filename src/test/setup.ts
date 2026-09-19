import { resolveTestDatabaseUrl } from './dbUrl.ts'

// Runs in every worker before any module reads DATABASE_URL, which
// src/db/index.ts does at import time.
process.env.DATABASE_URL = resolveTestDatabaseUrl().testUrl
