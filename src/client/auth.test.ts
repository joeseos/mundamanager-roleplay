import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'

const syncSession = vi.fn()
const clearSession = vi.fn()
vi.mock('#/server/fn/session.ts', () => ({
  syncSession: (args: unknown) => syncSession(args),
  clearSession: () => clearSession(),
}))

const signInWithPassword = vi.fn()
const supabaseSignOut = vi.fn()
vi.mock('#/client/supabase.ts', () => ({
  getSupabaseClient: () => ({ auth: { signInWithPassword, signOut: supabaseSignOut } }),
}))

const config = { url: 'https://example.supabase.co', publishableKey: 'key' }
const credentials = { email: 'venator@example.com', password: 'secret' }

type Router = Parameters<typeof import('./auth.tsx').signIn>[1]

/** Only `invalidate` is used; the rest of the router never comes into play. */
function fakeRouter() {
  return { invalidate: vi.fn(async () => {}) } as unknown as Router & { invalidate: Mock }
}

/** Fresh module per test: which token is mirrored lives in module scope. */
async function loadAuth() {
  vi.resetModules()
  return import('./auth.tsx')
}

beforeEach(() => {
  vi.clearAllMocks()
  syncSession.mockResolvedValue({})
  clearSession.mockResolvedValue({ ok: true })
  supabaseSignOut.mockResolvedValue({ error: null })
  signInWithPassword.mockResolvedValue({
    data: { session: { access_token: 'token-1' } },
    error: null,
  })
})

describe('signIn', () => {
  it('resolves only once the cookie is set and the router has reloaded', async () => {
    const { signIn } = await loadAuth()
    const router = fakeRouter()

    await signIn(config, router, credentials)

    expect(syncSession).toHaveBeenCalledExactlyOnceWith({ data: { accessToken: 'token-1' } })
    expect(router.invalidate).toHaveBeenCalledOnce()
  })

  it('rejects with the Supabase error and never touches the cookie', async () => {
    const { signIn } = await loadAuth()
    signInWithPassword.mockResolvedValue({
      data: { session: null },
      error: new Error('Invalid login credentials'),
    })

    await expect(signIn(config, fakeRouter(), credentials)).rejects.toThrow(
      'Invalid login credentials',
    )
    expect(syncSession).not.toHaveBeenCalled()
  })

  // The form used to hang on "Signing in..." when this failed.
  it('rejects when the cookie sync fails, and syncs again on retry', async () => {
    const { signIn } = await loadAuth()
    syncSession.mockRejectedValueOnce(new Error('JWKS unavailable'))

    await expect(signIn(config, fakeRouter(), credentials)).rejects.toThrow('JWKS unavailable')
    await signIn(config, fakeRouter(), credentials)

    expect(syncSession).toHaveBeenCalledTimes(2)
  })
})

describe('signOut', () => {
  it('shares one clear and one reload between concurrent callers', async () => {
    const { signOut } = await loadAuth()
    const router = fakeRouter()

    await Promise.all([signOut(config, router), signOut(config, router)])

    expect(clearSession).toHaveBeenCalledOnce()
    expect(router.invalidate).toHaveBeenCalledOnce()
  })

  it('clears the cookie again after a sign-in in between', async () => {
    const { signIn, signOut } = await loadAuth()
    const router = fakeRouter()

    await signOut(config, router)
    await signIn(config, router, credentials)
    await signOut(config, router)

    expect(clearSession).toHaveBeenCalledTimes(2)
  })
})
