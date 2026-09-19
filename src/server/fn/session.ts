import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { clearAuthCookie, writeAuthCookie } from '#/auth/cookie.ts'
import { upsertUserFromIdentity } from '#/auth/user.ts'
import { verifyAccessToken } from '#/auth/verify.ts'
import { toPublicUser } from '#/server/publicUser.ts'

/**
 * The bridge from supabase-js to this app's cookie.
 *
 * The client calls this on SIGNED_IN and on every TOKEN_REFRESHED. We verify
 * the token here -- signature via the project's JWKS, plus `iss` and `aud` --
 * then store it in an HttpOnly cookie so EventSource can authenticate too.
 */
export const syncSession = createServerFn({ method: 'POST' })
  .validator(z.object({ accessToken: z.string().min(1) }))
  .handler(async ({ data }) => {
    const identity = await verifyAccessToken(data.accessToken)
    const user = await upsertUserFromIdentity(identity)
    writeAuthCookie(data.accessToken, identity.expiresAt)
    return toPublicUser(user)
  })

export const clearSession = createServerFn({ method: 'POST' }).handler(() => {
  clearAuthCookie()
  return { ok: true as const }
})

/**
 * Everything the client needs to boot: the public Supabase config plus who
 * the cookie says we are.
 *
 * The config is served at runtime rather than baked into the client bundle at
 * build time, which keeps the Docker image environment-agnostic -- one
 * published tag runs anywhere, and pointing at a different Supabase project is
 * an env change rather than a rebuild.
 */
export const getBootstrap = createServerFn({ method: 'GET' }).handler(
  ({ context }) => {
    const url = process.env.VITE_SUPABASE_URL
    const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
    if (!url || !publishableKey) {
      throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY must be set')
    }

    return {
      supabase: { url, publishableKey },
      user: context.user ? toPublicUser(context.user) : null,
    }
  },
)
