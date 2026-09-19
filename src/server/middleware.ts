import { createMiddleware } from '@tanstack/react-start'

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

export function requireUser(context: { user: AppUser | null }): AppUser {
  if (!context.user) {
    throw new HttpError(401, 'Not signed in')
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
