import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

const YEAR = 60 * 60 * 24 * 365
const DAY = 60 * 60 * 24

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    devtools(),
    nitro({
      rollupConfig: { external: [/^@sentry\//] },
      routeRules: {
        // Nothing sets a cache header on static assets otherwise: Nitro
        // defaults publicAssets.maxAge to 0 and Start registers no rules, so
        // the one thing that is safe to cache forever was not cached at all.
        '/assets/**': {
          headers: { 'cache-control': `public, max-age=${YEAR}, immutable` },
        },
        // Deliberately not immutable: these filenames carry no content hash,
        // so a new backdrop or favicon has to be able to reach people.
        '/images/**': { headers: { 'cache-control': `public, max-age=${DAY}` } },
        '/background_numv5r.avif': {
          headers: { 'cache-control': `public, max-age=${DAY}` },
        },
        '/**': {
          headers: {
            'x-content-type-options': 'nosniff',
            'referrer-policy': 'strict-origin-when-cross-origin',
          },
        },
      },
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
})

export default config
