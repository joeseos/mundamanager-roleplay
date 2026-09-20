import { getCookie } from '@tanstack/react-start/server'

import { authCookieName } from '#/auth/cookie.ts'

const PRIVATE: Record<string, string> = { 'Cache-Control': 'private, no-store' }

/**
 * For routes with no per-user data of their own, but that still render inside
 * the root layout -- whose header shows the signed-in name and a sign-out
 * button once a session cookie exists. That markup is baked into the SSR
 * response, so a shared edge cache must never serve one visitor's copy to
 * another; falling back to `private, no-store` whenever the cookie is present
 * (even an expired one -- verifying it here would cost a JWKS round trip just
 * to decide a cache header) keeps that from happening.
 */
export function publicPageHeaders(): Record<string, string> {
  if (getCookie(authCookieName())) return PRIVATE
  return {
    'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    'CDN-Cache-Control': 'max-age=3600, stale-while-revalidate=86400',
    // Cloudflare's cache key ignores Cookie regardless of Vary, so this
    // route also needs a "bypass cache on cookie" Cache Rule there -- this
    // header is for any other cache in the chain (browser, a future CDN)
    // that does honor it.
    Vary: 'Cookie',
  }
}

/** Every route behind `requireUser` renders per-account data. */
export function privatePageHeaders(): Record<string, string> {
  return PRIVATE
}
