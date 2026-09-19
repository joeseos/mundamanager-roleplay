import { defineConfig } from 'vitest/config'

// Deliberately does not reuse vite.config.ts: the Start/Nitro plugins do
// build-time route generation and server-bundle work that unit tests neither
// need nor tolerate.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    globalSetup: ['src/test/globalSetup.ts'],
    setupFiles: ['src/test/setup.ts'],
    // The database-backed tests truncate between cases, so they must not run
    // against the same database concurrently.
    fileParallelism: false,
  },
  resolve: {
    alias: { '#': new URL('./src/', import.meta.url).pathname },
  },
})
