import { useRouter } from '@tanstack/react-router'
import { useEffect } from 'react'

import { clearSession, syncSession } from '#/server/fn/session.ts'

import { getSupabaseClient } from './supabase.ts'
import type { SupabaseConfig } from './supabase.ts'

/**
 * Keeps the HttpOnly auth cookie in step with the supabase-js session.
 *
 * supabase-js stores its session in localStorage, which EventSource cannot
 * reach. Mirroring the access token into a cookie on sign-in and on every
 * refresh is what lets the SSE stream authenticate as the same user, using the
 * same verification path as every server function.
 */
export function useAuthSync(config: SupabaseConfig) {
  const router = useRouter()

  useEffect(() => {
    const supabase = getSupabaseClient(config)
    let cancelled = false

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return

      void (async () => {
        if (session?.access_token) {
          // Covers INITIAL_SESSION, SIGNED_IN and TOKEN_REFRESHED: whenever a
          // token exists, the cookie should hold that exact token.
          await syncSession({ data: { accessToken: session.access_token } })
        } else if (event === 'SIGNED_OUT') {
          await clearSession()
        } else {
          return
        }
        await router.invalidate()
      })()
    })

    return () => {
      cancelled = true
      data.subscription.unsubscribe()
    }
  }, [config, router])
}

export async function signOut(config: SupabaseConfig) {
  await getSupabaseClient(config).auth.signOut()
}
