/**
 * The headers that keep a response out of every cache in the chain.
 *
 * Cloudflare reads `CDN-Cache-Control` in preference to `Cache-Control`, and a
 * Cache Rule with an Edge TTL override ignores the latter entirely, so both
 * have to say it.
 */
export const PRIVATE: Record<string, string> = {
  'Cache-Control': 'private, no-store',
  'CDN-Cache-Control': 'private, no-store',
}

interface HeadersContext {
  matches: Array<{ loaderData?: unknown }>
}

/**
 * For routes with no per-user data of their own, but that still render inside
 * the root layout -- whose header shows the signed-in name and a sign-out
 * button once someone is signed in. That markup is baked into the SSR
 * response, so a shared edge cache must never serve one visitor's copy to
 * another.
 *
 * The root loader has already resolved by the time this runs, so the decision
 * comes from the same value the layout renders rather than from a cookie probe.
 */
export function publicPageHeaders(ctx: HeadersContext): Record<string, string> {
  const root = ctx.matches[0]?.loaderData as { user?: unknown } | undefined
  // Fail closed: no root loader data means there is no way to tell who this
  // page was rendered for.
  if (!root || root.user) return PRIVATE

  return {
    'Cache-Control': 'public, max-age=0, s-maxage=60',
    'CDN-Cache-Control': 'max-age=60',
  }
}

/** Every route behind `requireUser` renders per-account data. */
export function privatePageHeaders(): Record<string, string> {
  return PRIVATE
}
