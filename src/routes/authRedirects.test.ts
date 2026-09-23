import { isRedirect } from '@tanstack/react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const getCurrentUser = vi.fn()
vi.mock('#/server/fn/session.ts', () => ({ getCurrentUser: () => getCurrentUser() }))

const { Route: Home } = await import('./index.tsx')
const { Route: SignIn } = await import('./sign-in.tsx')

/** Where a guard sends us, or null if it lets the page render. */
async function redirectOf(route: typeof Home | typeof SignIn): Promise<string | null> {
  try {
    await route.options.beforeLoad?.({} as never)
    return null
  } catch (error) {
    if (isRedirect(error)) return error.options.to as string
    throw error
  }
}

beforeEach(() => getCurrentUser.mockReset())

describe('start page redirects', () => {
  it('sends a signed-out visitor from / to /sign-in, and lets /sign-in render', async () => {
    getCurrentUser.mockResolvedValue(null)

    expect(await redirectOf(Home)).toBe('/sign-in')
    expect(await redirectOf(SignIn)).toBeNull()
  })

  it('sends a signed-in user from /sign-in to /, and lets / render', async () => {
    getCurrentUser.mockResolvedValue({ id: 'user-1', displayName: 'Venator' })

    expect(await redirectOf(SignIn)).toBe('/')
    expect(await redirectOf(Home)).toBeNull()
  })

  // The regression this guards: each guard reading its own copy of the user,
  // so that / and /sign-in redirected to each other forever.
  it('asks the server on every check rather than trusting an earlier answer', async () => {
    getCurrentUser.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'user-1' })

    expect(await redirectOf(Home)).toBe('/sign-in')
    expect(await redirectOf(SignIn)).toBe('/')
    expect(getCurrentUser).toHaveBeenCalledTimes(2)
  })
})
