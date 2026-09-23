import { createFileRoute, redirect } from '@tanstack/react-router'

import { PRIVATE } from '#/server/cacheHeaders.ts'
import { getCurrentUser } from '#/server/fn/session.ts'

export const Route = createFileRoute('/')({
  // Signed-out visitors start at /sign-in, as on Munda Manager. No `headers`
  // of its own: every page this route renders is a signed-in one, so the
  // root's private default is the right one.
  beforeLoad: async () => {
    if (!(await getCurrentUser())) {
      throw redirect({ to: '/sign-in', headers: PRIVATE })
    }
  },
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
