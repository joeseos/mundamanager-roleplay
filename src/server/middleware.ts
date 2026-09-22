import { redirect } from '@tanstack/react-router'
import { createMiddleware } from '@tanstack/react-start'

import { PRIVATE } from '#/server/cacheHeaders.ts'

import { readAuthCookie } from '#/auth/cookie.ts'
import { findUserBySupabaseId } from '#/auth/user.ts'
import { verifyAccessToken } from '#/auth/verify.ts'
import type { User } from '#/db/schema.ts'

export type AppUser = User

/** Thrown by `requireUser` and the authorization helpers. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'HttpError'
  }
}

async function resolveUser(request: Request): Promise<AppUser | null> {
  const token = readAuthCookie(request)
  if (!token) return null

  try {
    const identity = await verifyAccessToken(token)
    // The local row is the authority on who this is inside this app. The
    // token only establishes *which* account is calling.
    return await findUserBySupabaseId(identity.supabaseUserId)
  } catch {
    // An expired or malformed cookie is an anonymous request, not a crash.
    // The client re-syncs after a 401.
    return null
  }
}

/**
 * The one place a request is authenticated.
 *
 * Registered globally in src/start.ts, which the docs describe as running
 * "before every request, including server routes, SSR and server functions" --
 * so the SSE route and every server function share this single code path.
 *
 * It never throws: unauthenticated requests get `user: null` so that SSR of
 * public pages (notably /login) still works. Use `requireUser` at the point
 * where a caller actually needs an identity.
 */
export const authMiddleware = createMiddleware().server(
  async ({ next, request }) => next({ context: { user: await resolveUser(request) } }),
)

/**
 * Throws a redirect rather than a 401 so that an expired cookie on a page load
 * lands the caller on /login instead of an error boundary. Start carries a
 * thrown redirect across the server-function boundary.
 *
 * The SSE route does not use this: EventSource cannot follow a redirect
 * usefully, so it answers 401 directly and the client stops retrying.
 */
export function requireUser(context: { user: AppUser | null }): AppUser {
  if (!context.user) {
    throw redirect({ to: '/login', headers: PRIVATE })
  }
  return context.user
}

declare module '@tanstack/react-router' {
  interface Register {
    server: {
      requestContext: { user: AppUser | null }
    }
  }
}
