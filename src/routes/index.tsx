import { createFileRoute } from '@tanstack/react-router'

import { publicPageHeaders } from '#/server/cacheHeaders.ts'

export const Route = createFileRoute('/')({
  headers: publicPageHeaders,
  component: Home,
})

function Home() {
  return (
    <main className="mx-auto max-w-2xl rounded-b-lg bg-page p-8">
      <h1 className="text-3xl font-bold">Munda Manager Roleplay</h1>
      <p className="mt-2 text-fg-muted">
        Companion app for Venators and their Arbitrator.
      </p>
    </main>
  )
}
