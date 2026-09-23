import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useState } from 'react'

import { signIn } from '#/client/auth.tsx'
import { useBootstrap } from '#/client/bootstrap.ts'
import { Button } from '#/components/button.tsx'
import { PRIVATE, publicPageHeaders } from '#/server/cacheHeaders.ts'
import { getCurrentUser } from '#/server/fn/session.ts'

export const Route = createFileRoute('/sign-in')({
  headers: publicPageHeaders,
  // Nothing to do here once signed in. This is also what finishes a sign-in:
  // signIn reloads the router, which re-runs this check.
  beforeLoad: async () => {
    if (await getCurrentUser()) {
      throw redirect({ to: '/', headers: PRIVATE })
    }
  },
  component: Login,
})

/**
 * Email and password only. Every identity on the Munda Manager project is an
 * email identity -- there is no OAuth provider configured -- so a social
 * button here would be dead UI.
 */
function Login() {
  const router = useRouter()
  const { supabase } = useBootstrap()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function signInWithPassword(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)

    try {
      // By the time this resolves, beforeLoad has already sent us home.
      await signIn(supabase, router, { email, password })
    } catch (signInError) {
      setBusy(false)
      setError(signInError instanceof Error ? signInError.message : 'Sign-in failed.')
    }
  }

  return (
    <main className="mx-auto max-w-sm rounded-b-lg bg-page p-8">
      <h1 className="text-2xl font-bold">Sign in</h1>
      <p className="mt-1 text-sm text-fg-muted">
        Use your existing Munda Manager account.
      </p>

      <form onSubmit={signInWithPassword} className="mt-6 space-y-3">
        <input
          type="email"
          required
          autoComplete="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded border border-line-strong bg-field px-3 py-2"
        />
        <input
          type="password"
          required
          autoComplete="current-password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded border border-line-strong bg-field px-3 py-2"
        />
        <Button type="submit" disabled={busy} className="w-full px-3 py-2">
          {busy ? 'Signing in...' : 'Sign in'}
        </Button>
      </form>


      {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}
    </main>
  )
}
