import { deleteCookie, setCookie } from '@tanstack/react-start/server'

/**
 * The access token is bridged from supabase-js (which keeps it in
 * localStorage) into an HttpOnly cookie, because EventSource cannot set an
 * Authorization header. The cookie is then the single transport the server
 * reads -- server functions and the SSE route alike -- so there is exactly one
 * place that decides who the caller is.
 */
function isProduction(): boolean {
  return process.env.NODE_ENV === 'production'
}

export function authCookieName(): string {
  // The __Host- prefix requires Secure, which browsers do allow on
  // http://localhost. Dev uses an unprefixed name anyway so that running the
  // dev server over plain http on a LAN address still works.
  return isProduction() ? '__Host-nrp_token' : 'nrp_token'
}

/**
 * Reads straight off the Request rather than via the ambient cookie helpers,
 * so this behaves identically in request middleware and in a server route
 * handler.
 */
export function readAuthCookie(request: Request): string | null {
  const header = request.headers.get('cookie')
  if (!header) return null

  const name = authCookieName()
  for (const part of header.split(/;\s*/)) {
    const eq = part.indexOf('=')
    if (eq === -1) continue
    if (part.slice(0, eq) === name) {
      return decodeURIComponent(part.slice(eq + 1))
    }
  }
  return null
}

/** Cookie lifetime tracks the token's own `exp`, so it cannot outlive it. */
export function writeAuthCookie(token: string, expiresAt: number): void {
  const maxAge = Math.max(0, expiresAt - Math.floor(Date.now() / 1000))
  setCookie(authCookieName(), token, {
    httpOnly: true,
    // Browsers exempt localhost from the Secure-requires-HTTPS rule but not a
    // LAN address, and dev runs over plain http.
    secure: isProduction(),
    sameSite: 'lax',
    path: '/',
    maxAge,
  })
}

export function clearAuthCookie(): void {
  deleteCookie(authCookieName(), {
    httpOnly: true,
    secure: isProduction(),
    sameSite: 'lax',
    path: '/',
  })
}
