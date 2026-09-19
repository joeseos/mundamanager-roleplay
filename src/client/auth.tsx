import { useRouter } from '@tanstack/react-router'
import { useEffect } from 'react'

import { clearSession, syncSession } from '#/server/fn/session.ts'

import { getSupabaseClient } from './supabase.ts'
import type { SupabaseConfig } from './supabase.ts'

/**
 * The last access token we successfully mirrored into the cookie.
 *
 * Module scope rather than a ref: onAuthStateChange can fire from more than
 * one mounted subscriber, and this needs to dedupe across all of them.
 */
let lastSyncedToken: string | null = null

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

      void (async () => {
        if (event === 'SIGNED_OUT' || !session?.access_token) {
          if (event !== 'SIGNED_OUT') return
          lastSyncedToken = null
          await clearSession()
          await router.invalidate()
          return
        }

        const token = session.access_token

        // Already mirrored this exact token.
        if (token === lastSyncedToken) return

        // INITIAL_SESSION fires on every page load and on tab focus. If the
        // server already resolved us from the cookie, the cookie is current
        // and there is nothing to do -- syncing here would cost a round trip
        // and a users upsert on every page view.
        if (event === 'INITIAL_SESSION' && serverUserId) {
          lastSyncedToken = token
          return
        }

        await syncSession({ data: { accessToken: token } })
        lastSyncedToken = token
        await router.invalidate()
      })()
    })

    return () => {
      cancelled = true
      data.subscription.unsubscribe()
    }
  }, [config, router, serverUserId])
}

export async function signOut(config: SupabaseConfig) {
  await getSupabaseClient(config).auth.signOut()
}
