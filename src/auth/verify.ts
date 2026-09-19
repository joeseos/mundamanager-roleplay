import { createRemoteJWKSet, jwtVerify } from 'jose'
import type { JWTPayload, JWTVerifyGetKey } from 'jose'

/**
 * Everything this app is willing to believe from a Supabase access token.
 *
 * The token is issued by another app's Supabase project (MundaManager) and
 * carries that app's custom claims. This type is the whole contract: the
 * payload is never spread, and no caller ever sees the raw claims.
 *
 * Exactly one custom claim is read -- `user_profile.username` -- and only as a
 * display string to seed a new local account. Everything else in that claim
 * describes the other app's authorization and entitlement model
 * (`user_role`, `patreon_tier_id`, `patreon_tier_title`, `patron_status`) and
 * is deliberately dropped.
 *
 * Every role in this app (arbitrator, player, admin) comes from this app's own
 * database, never from the token.
 */
export interface VerifiedIdentity {
  supabaseUserId: string
  email: string
  /** Seed values for first login only. Owned locally afterwards. */
  displayName: string | null
  avatarUrl: string | null
  /** Unix seconds, used to bound the auth cookie's lifetime. */
  expiresAt: number
}

export class TokenVerificationError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'TokenVerificationError'
  }
}

function supabaseUrl(): string {
  // Read inside the function, never at module scope: a module-level read can
  // be inlined into a bundle and is wrong on a server that is configured at
  // runtime.
  const url = process.env.VITE_SUPABASE_URL
  if (!url) {
    throw new TokenVerificationError('VITE_SUPABASE_URL is not set')
  }
  return url.replace(/\/+$/, '')
}

export function issuerFor(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/auth/v1`
}

let cachedJwks: JWTVerifyGetKey | undefined
let cachedJwksUrl: string | undefined

/**
 * A remote JWKS, so signing-key rotation in the Supabase project needs no
 * deploy here. jose caches and refetches on unknown `kid` by itself.
 */
function jwks(baseUrl: string): JWTVerifyGetKey {
  const url = `${issuerFor(baseUrl)}/.well-known/jwks.json`
  if (!cachedJwks || cachedJwksUrl !== url) {
    cachedJwks = createRemoteJWKSet(new URL(url))
    cachedJwksUrl = url
  }
  return cachedJwks
}

function firstString(...values: Array<unknown>): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim() !== '') return value.trim()
  }
  return null
}

/**
 * Pulls the identity fields out of a verified payload by name.
 *
 * Deliberately explicit rather than a spread or a pick-list: anything the
 * other app adds to the token is dropped here by construction, not by a
 * denylist that would need maintaining.
 */
export function readIdentity(payload: JWTPayload): VerifiedIdentity {
  const supabaseUserId = payload.sub
  if (!supabaseUserId) {
    throw new TokenVerificationError('token has no sub claim')
  }

  const email = firstString(payload.email)
  if (!email) {
    throw new TokenVerificationError('token has no email claim')
  }

  if (typeof payload.exp !== 'number') {
    throw new TokenVerificationError('token has no exp claim')
  }

  // `user_metadata` is Supabase's own identity bag, populated by the auth
  // provider rather than by the other app.
  const metadata =
    payload.user_metadata && typeof payload.user_metadata === 'object'
      ? (payload.user_metadata as Record<string, unknown>)
      : {}

  // `user_profile` is injected by MundaManager's custom access token hook.
  // Only `username` is read from it, and only as a display string: it is the
  // name the player already goes by, and accounts here are created with
  // email/password, so nothing else in the token carries a name at all.
  //
  // The rest of that claim -- user_role, patreon_tier_id, patreon_tier_title,
  // patron_status -- is the other app's authorization and entitlement model.
  // Reading it here would let that app decide what someone can do in this one,
  // so it is never touched.
  const profile =
    payload.user_profile && typeof payload.user_profile === 'object'
      ? (payload.user_profile as Record<string, unknown>)
      : {}

  return {
    supabaseUserId,
    email,
    displayName: firstString(profile.username, metadata.full_name, metadata.name),
    avatarUrl: firstString(metadata.avatar_url, metadata.picture),
    expiresAt: payload.exp,
  }
}

/**
 * Exported so tests can verify against a locally generated key pair without
 * reaching the network.
 */
export async function verifyWith(
  token: string,
  keySource: JWTVerifyGetKey,
  issuer: string,
): Promise<VerifiedIdentity> {
  try {
    const { payload } = await jwtVerify(token, keySource, {
      // All three, as required: signature (via keySource), issuer, audience.
      issuer,
      audience: 'authenticated',
      // Asymmetric only. The project advertises HS256 alongside ES256/RS256,
      // and excluding the symmetric algorithm here forecloses any algorithm
      // confusion attack where a token is signed with a public key as if it
      // were an HMAC secret.
      algorithms: ['ES256', 'RS256'],
    })
    return readIdentity(payload)
  } catch (error) {
    if (error instanceof TokenVerificationError) throw error
    throw new TokenVerificationError('access token rejected', { cause: error })
  }
}

/** Verifies signature, `iss` and `aud` against the configured project. */
export async function verifyAccessToken(token: string): Promise<VerifiedIdentity> {
  const baseUrl = supabaseUrl()
  return verifyWith(token, jwks(baseUrl), issuerFor(baseUrl))
}
