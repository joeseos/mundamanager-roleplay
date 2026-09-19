import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'

import { getSupabaseClient } from '#/client/supabase.ts'
import { useBootstrap } from '#/client/bootstrap.ts'

export const Route = createFileRoute('/login')({ component: Login })

/**
 * Email and password only. Every identity on the MundaManager project is an
 * email identity -- there is no OAuth provider configured -- so a social
 * button here would be dead UI.
 */
function Login() {
  const router = useRouter()
  const { supabase, user } = useBootstrap()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function signInWithPassword(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)

    const { error: signInError } = await getSupabaseClient(
      supabase,
    ).auth.signInWithPassword({ email, password })

    setBusy(false)
    if (signInError) {
      setError(signInError.message)
      return
    }
    // useAuthSync mirrors the token into the cookie and invalidates the
    // router, so by the time we navigate the server already knows us.
    await router.navigate({ to: '/' })
  }

  if (user) {
    return (
      <main className="mx-auto max-w-sm p-8">
        <p className="text-stone-300">
          Signed in as <strong>{user.displayName}</strong>.
        </p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-sm p-8">
      <h1 className="text-2xl font-bold">Sign in</h1>
      <p className="mt-1 text-sm text-stone-300">
        Uses your existing MundaManager account.
      </p>

      <form onSubmit={signInWithPassword} className="mt-6 space-y-3">
        <input
          type="email"
          required
          autoComplete="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded border border-stone-700 bg-stone-900/70 px-3 py-2"
        />
        <input
          type="password"
          required
          autoComplete="current-password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded border border-stone-700 bg-stone-900/70 px-3 py-2"
        />
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded bg-amber-600 px-3 py-2 font-medium text-stone-950 disabled:opacity-50"
        >
          {busy ? 'Signing in...' : 'Sign in'}
        </button>
      </form>


      {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}
    </main>
  )
}
