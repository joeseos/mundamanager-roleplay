import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useState } from 'react'

import { signIn } from '#/client/auth.tsx'
import { useBootstrap } from '#/client/bootstrap.ts'
import { PRIVATE, publicPageHeaders } from '#/server/cacheHeaders.ts'
import { getCurrentUser } from '#/server/fn/session.ts'

export const Route = createFileRoute('/sign-in')({
  headers: publicPageHeaders,
  // Nothing to do here once signed in. This is also what finishes a sign-in:
  // signIn reloads the router, which re-runs this check.
  beforeLoad: async () => {
    if (await getCurrentUser()) {
      throw redirect({ to: '/', headers: PRIVATE })
    }
  },
  component: Login,
})

/** Accounts live on Munda Manager, so sign-up and password reset happen there. */
const MUNDA_MANAGER_URL = 'https://www.mundamanager.com'
const HELP_URL = 'https://discord.gg/ZWXXqd5NUt'

// HTML type="email" allows local domains like "user@host"; require a dot in the domain.
const EMAIL_PATTERN = String.raw`[^\s@]+@[^\s@]+\.[^\s@]+`

/*
 * Munda Manager's shadcn tokens, as Tailwind classes: `bg-muted`,
 * `border-input`, `text-foreground` and `placeholder:text-muted-foreground`,
 * light then dark.
 */
const INPUT_CLASSES =
  'flex h-10 w-full rounded-md border px-3 py-2 text-base md:text-sm ' +
  'border-neutral-200 bg-neutral-100 text-neutral-950 placeholder:text-[hsl(220_14%_34%)] ' +
  'dark:border-[hsl(0_0%_11.9%)] dark:bg-neutral-800 dark:text-neutral-50 dark:placeholder:text-neutral-400 ' +
  'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2 ' +
  'dark:focus-visible:ring-neutral-300 disabled:cursor-not-allowed disabled:opacity-50'

const LABEL_CLASSES = 'text-sm leading-none font-medium'

const LINK_CLASSES = 'font-medium text-white underline'

/**
 * Email and password only. Every identity on the Munda Manager project is an
 * email identity -- there is no OAuth provider configured -- so a social
 * button here would be dead UI.
 *
 * Styled after Munda Manager's own sign-in page: no panel, white text straight
 * on the backdrop in both themes. It departs from it only where Munda
 * Manager's version has accessibility gaps: the password reveal and the
 * password label's spacing.
 */
function Login() {
  const router = useRouter()
  const { supabase } = useBootstrap()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function signInWithPassword(event: React.FormEvent) {
    event.preventDefault()
    // Back to a password field, so password managers offer to save it as one.
    setShowPassword(false)
    setBusy(true)
    setError(null)

    try {
      // By the time this resolves, beforeLoad has already sent us home.
      await signIn(supabase, router, { email, password })
    } catch (signInError) {
      setBusy(false)
      setError(signInError instanceof Error ? signInError.message : 'Sign-in failed.')
    }
  }

  return (
    <main className="flex flex-col items-center pt-14 pb-8">
      <div className="mx-auto w-full max-w-4xl px-4">
        <form
          onSubmit={signInWithPassword}
          className="mx-auto flex w-full max-w-sm flex-col text-white"
        >
          <h1 className="mb-2 text-center text-2xl font-medium">Sign In</h1>
          <p className="mb-8 text-center text-sm">
            Don&apos;t have an account yet?{' '}
            <a className={LINK_CLASSES} href={`${MUNDA_MANAGER_URL}/sign-up`}>
              Sign up
            </a>
          </p>

          <div className="flex flex-col gap-4">
            <div>
              <label htmlFor="email" className={LABEL_CLASSES}>
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                pattern={EMAIL_PATTERN}
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                aria-invalid={!!emailError}
                aria-describedby={emailError ? 'email-error' : undefined}
                onInvalid={(e) => {
                  e.preventDefault()
                  setEmailError(emailErrorFrom(e.currentTarget.validity) ?? 'Must be an email address')
                }}
                onChange={(e) => {
                  setEmail(e.target.value)
                  const nextError = emailErrorFrom(e.target.validity)
                  // Clear as soon as it's fixed, but don't nag while still typing.
                  if (nextError === null || emailError) setEmailError(nextError)
                }}
                className={`mt-1 ${INPUT_CLASSES}`}
              />
              {emailError ? <FieldError id="email-error">{emailError}</FieldError> : null}
            </div>

            <div>
              <label htmlFor="password" className={LABEL_CLASSES}>
                Password
              </label>
              <div className="relative mt-1">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  aria-invalid={!!passwordError}
                  aria-describedby={passwordError ? 'password-error' : undefined}
                  onInvalid={(e) => {
                    e.preventDefault()
                    setPasswordError('Password is required')
                  }}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    if (e.target.validity.valid) setPasswordError(null)
                  }}
                  className={`pr-10 ${INPUT_CLASSES}`}
                />
                {/* A toggle rather than Munda Manager's hold-to-reveal: a click
                    works the same from mouse, touch and keyboard, and nothing
                    can leave the password showing by missing a touchend. The
                    label stays fixed; aria-pressed carries the state. */}
                <button
                  type="button"
                  onClick={() => setShowPassword((shown) => !shown)}
                  aria-label="Show password"
                  aria-pressed={showPassword}
                  aria-controls="password"
                  className="absolute top-1/2 right-3 -translate-y-1/2 rounded-sm text-[hsl(220_14%_34%)] transition-colors hover:text-neutral-950 focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:outline-hidden dark:text-neutral-400 dark:hover:text-neutral-50 dark:focus-visible:ring-neutral-300"
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
              {passwordError ? <FieldError id="password-error">{passwordError}</FieldError> : null}
            </div>

            {error ? <div className="text-sm text-red-400">{error}</div> : null}

            <a
              href={`${MUNDA_MANAGER_URL}/reset-password`}
              className="self-end text-sm text-white underline"
            >
              Forgot your password?
            </a>

            <button
              type="submit"
              disabled={busy}
              className="mt-2 inline-flex h-10 items-center justify-center rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium whitespace-nowrap text-white transition-colors hover:bg-gray-800 focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50 dark:focus-visible:ring-neutral-300"
            >
              {busy ? 'Signing In...' : 'Sign In'}
            </button>
          </div>

          <p className="mt-4 text-center text-sm">
            Having trouble?{' '}
            <a href={HELP_URL} target="_blank" rel="noopener noreferrer" className={LINK_CLASSES}>
              Get help
            </a>
          </p>
        </form>
      </div>
    </main>
  )
}

function emailErrorFrom(validity: ValidityState): string | null {
  if (validity.valid) return null
  if (validity.valueMissing) return 'Email is required'
  return 'Must be an email address'
}

function FieldError({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <p id={id} role="alert" aria-live="polite" className="mt-1 flex items-start gap-1 text-sm text-red-400">
      {/* Remix Icon's error-warning-fill, as Munda Manager uses. */}
      <svg viewBox="0 0 24 24" fill="currentColor" className="mt-0.5 h-4 w-4 shrink-0" aria-hidden>
        <path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10Zm-1-7v2h2v-2h-2Zm0-8v6h2V7h-2Z" />
      </svg>
      {children}
    </p>
  )
}

/* Lucide's eye and eye-off, as Munda Manager uses. */
const ICON_PROPS = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  className: 'h-5 w-5',
  'aria-hidden': true,
} as const

function EyeIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
      <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
      <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />
      <path d="m2 2 20 20" />
    </svg>
  )
}
