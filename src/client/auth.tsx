import { useRouter } from '@tanstack/react-router'
import { useEffect } from 'react'

import { clearSession, syncSession } from '#/server/fn/session.ts'

import { getSupabaseClient } from './supabase.ts'
import type { SupabaseConfig } from './supabase.ts'

type Router = ReturnType<typeof useRouter>

/**
 * The token the cookie holds or is being set to (null: cleared), and the
 * round trip that gets it there, router invalidation included.
 *
 * Module scope rather than a ref: onAuthStateChange can fire from more than
 * one mounted subscriber, and sign-in and sign-out also wait on it, so they
 * all share one sync per change instead of each posting their own.
 */
let mirror: { token: string | null; done: Promise<void> } | null = null

function mirrorToken(router: Router, token: string | null): Promise<void> {
  if (mirror && mirror.token === token) return mirror.done

  const done = (async () => {
    if (token) await syncSession({ data: { accessToken: token } })
    else await clearSession()
    await router.invalidate()
  })()
  const current = { token, done }
  mirror = current
  // A failed sync must not look mirrored, or the next attempt would skip it.
  done.catch(() => {
    if (mirror === current) mirror = null
  })
  return done
}

/**
 * Keeps the HttpOnly auth cookie in step with the supabase-js session.
 *
 * supabase-js stores its session in localStorage, which EventSource cannot
 * reach. Mirroring the access token into a cookie on sign-in and on every
 * refresh is what lets the SSE stream authenticate as the same user, through
 * the same verification path as every server function.
 *
 * Cost, deliberately: this runs on sign-in and on token refresh only -- not
 * per request and not per page load. Request-time verification is a local
 * signature check against the in-memory JWKS cache, so the server never calls
 * Supabase on the request path. In particular it never calls
 * supabase.auth.getUser(), which would be a network round trip per request.
 *
 * The trade that buys: a session revoked in the other app stays valid here
 * until the access token expires. Right trade for this app. If it ever is not,
 * the lever is a flag on the local `users` row checked in the middleware --
 * effective on the next request -- not a round trip per request.
 */
export function useAuthSync(config: SupabaseConfig, serverUserId: string | null) {
  const router = useRouter()

  useEffect(() => {
    const supabase = getSupabaseClient(config)
    let cancelled = false

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return

      let token: string | null
      if (event === 'SIGNED_OUT') token = null
      else if (session?.access_token) token = session.access_token
      else return

      // INITIAL_SESSION fires on every page load and on tab focus. If the
      // server already resolved us from the cookie, the cookie is current and
      // there is nothing to do -- syncing here would cost a round trip and a
      // users upsert on every page view.
      if (event === 'INITIAL_SESSION' && serverUserId && token) {
        mirror = { token, done: Promise.resolve() }
        return
      }

      // Sign-in and sign-out surface their own failures; this catches the
      // ones nobody is waiting on, such as a background token refresh.
      mirrorToken(router, token).catch((error: unknown) => {
        console.error('Auth cookie sync failed', error)
      })
    })

    return () => {
      cancelled = true
      data.subscription.unsubscribe()
    }
  }, [config, router, serverUserId])
}

/**
 * Resolves once the server knows us and the router has reloaded, so route
 * guards have already acted on the new session. Throws on a failed sign-in or
 * a failed cookie sync alike.
 */
export async function signIn(
  config: SupabaseConfig,
  router: Router,
  credentials: { email: string; password: string },
) {
  const { data, error } = await getSupabaseClient(config).auth.signInWithPassword(credentials)
  if (error) throw error
  await mirrorToken(router, data.session.access_token)
}

/** Resolves once the cookie is cleared and the router has reloaded. */
export async function signOut(config: SupabaseConfig, router: Router) {
  await getSupabaseClient(config).auth.signOut()
  await mirrorToken(router, null)
}
