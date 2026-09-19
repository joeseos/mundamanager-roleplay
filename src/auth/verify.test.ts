import { SignJWT, generateKeyPair } from 'jose'
import type { JWTVerifyGetKey } from 'jose'
import { describe, expect, it } from 'vitest'

import { TokenVerificationError, issuerFor, verifyWith } from './verify.ts'

const PROJECT = 'https://example-project.supabase.co'
const ISSUER = issuerFor(PROJECT)

const signing = await generateKeyPair('ES256')
const attacker = await generateKeyPair('ES256')

const keySource: JWTVerifyGetKey = async () => signing.publicKey

interface SignOptions {
  issuer?: string
  audience?: string
  expiresIn?: number
  key?: CryptoKey
  claims?: Record<string, unknown>
}

async function sign({
  issuer = ISSUER,
  audience = 'authenticated',
  expiresIn = 3600,
  key = signing.privateKey,
  claims = {},
}: SignOptions = {}): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  return new SignJWT({ email: 'venator@example.com', ...claims })
    .setProtectedHeader({ alg: 'ES256' })
    .setSubject('supabase-sub-123')
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt(now)
    .setExpirationTime(now + expiresIn)
    .sign(key)
}

describe('verifyAccessToken', () => {
  it('accepts a correctly signed token and returns the identity', async () => {
    const identity = await verifyWith(await sign(), keySource, ISSUER)

    expect(identity.supabaseUserId).toBe('supabase-sub-123')
    expect(identity.email).toBe('venator@example.com')
    expect(identity.expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000))
  })

  it('rejects a token signed by a different key', async () => {
    await expect(
      verifyWith(await sign({ key: attacker.privateKey }), keySource, ISSUER),
    ).rejects.toThrow(TokenVerificationError)
  })

  it('rejects a token from a different issuer', async () => {
    await expect(
      verifyWith(
        await sign({ issuer: 'https://evil-project.supabase.co/auth/v1' }),
        keySource,
        ISSUER,
      ),
    ).rejects.toThrow(TokenVerificationError)
  })

  it('rejects a token with the wrong audience', async () => {
    await expect(
      verifyWith(await sign({ audience: 'anon' }), keySource, ISSUER),
    ).rejects.toThrow(TokenVerificationError)
  })

  it('rejects an expired token', async () => {
    await expect(
      verifyWith(await sign({ expiresIn: -60 }), keySource, ISSUER),
    ).rejects.toThrow(TokenVerificationError)
  })

  it('rejects a token with no email claim', async () => {
    const token = await sign({ claims: { email: undefined } })
    await expect(verifyWith(token, keySource, ISSUER)).rejects.toThrow(
      /no email claim/,
    )
  })

  it('seeds display name and avatar from user_metadata', async () => {
    const identity = await verifyWith(
      await sign({
        claims: {
          user_metadata: {
            full_name: 'Kal Jerico',
            avatar_url: 'https://example.com/kal.png',
          },
        },
      }),
      keySource,
      ISSUER,
    )

    expect(identity.displayName).toBe('Kal Jerico')
    expect(identity.avatarUrl).toBe('https://example.com/kal.png')
  })

  it('seeds the display name from the MundaManager username claim', async () => {
    const identity = await verifyWith(
      await sign({
        claims: {
          user_profile: { user_role: 'user', username: 'joesoes' },
        },
      }),
      keySource,
      ISSUER,
    )

    expect(identity.displayName).toBe('joesoes')
  })

  it('prefers the username claim over provider metadata', async () => {
    const identity = await verifyWith(
      await sign({
        claims: {
          user_profile: { username: 'joesoes' },
          user_metadata: { full_name: 'Someone Else' },
        },
      }),
      keySource,
      ISSUER,
    )

    // The username is what the player actually goes by in the other app.
    expect(identity.displayName).toBe('joesoes')
  })

  it('survives a token with no user_profile claim at all', async () => {
    // The hook returns the event unchanged when there is no profile row.
    const identity = await verifyWith(await sign(), keySource, ISSUER)

    expect(identity.displayName).toBeNull()
    expect(identity.supabaseUserId).toBe('supabase-sub-123')
  })

  /**
   * The point of the whole module. `username` is read as a display string;
   * everything else in that claim is the other app's authorization and
   * entitlement model and must not cross over.
   */
  it('discards the authorization and entitlement claims', async () => {
    const identity = await verifyWith(
      await sign({
        claims: {
          role: 'service_role',
          user_profile: {
            username: 'joesoes',
            user_role: 'admin',
            patreon_tier_id: 'tier_9',
            patreon_tier_title: 'Champion of the Underhive',
            patron_status: 'active_patron',
          },
        },
      }),
      keySource,
      ISSUER,
    )

    expect(Object.keys(identity).sort()).toEqual([
      'avatarUrl',
      'displayName',
      'email',
      'expiresAt',
      'supabaseUserId',
    ])

    const serialised = JSON.stringify(identity)
    for (const leaked of [
      'service_role',
      'admin',
      'tier_9',
      'Champion of the Underhive',
      'active_patron',
    ]) {
      expect(serialised).not.toContain(leaked)
    }
  })
})
