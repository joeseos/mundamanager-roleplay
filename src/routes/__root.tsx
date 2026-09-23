import {
  HeadContent,
  Link,
  Outlet,
  ScriptOnce,
  Scripts,
  createRootRoute,
  useRouter,
  useRouterState,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'

import { signOut, useAuthSync } from '#/client/auth.tsx'
import { themeScript } from '#/client/theme.ts'
import { Button } from '#/components/button.tsx'
import { Footer } from '#/components/footer.tsx'
import { ThemeToggle } from '#/components/themeToggle.tsx'
import { privatePageHeaders } from '#/server/cacheHeaders.ts'
import { getBootstrap } from '#/server/fn/session.ts'

import appCss from '../styles.css?url'

/** Kept in step with the `body::before` rule in styles.css. */
const BACKGROUND_URL = '/background_numv5r.avif'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Munda Manager Roleplay' },
      {
        name: 'description',
        content: 'A companion tool for Necromunda Roleplay.',
      },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      // The backdrop is a CSS background, so the browser only discovers it
      // after the stylesheet parses. Preloading avoids a flash of flat black.
      { rel: 'preload', as: 'image', href: BACKGROUND_URL, type: 'image/avif' },
      { rel: 'icon', href: '/favicon.ico', sizes: 'any' },
      { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/images/favicon-16x16.png' },
      { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/images/favicon-32x32.png' },
      { rel: 'icon', type: 'image/png', sizes: '96x96', href: '/images/favicon-96x96.png' },
      { rel: 'icon', type: 'image/png', sizes: '192x192', href: '/images/favicon-192x192.png' },
      { rel: 'apple-touch-icon', sizes: '180x180', href: '/images/apple-touch-icon.png' },
      { rel: 'manifest', href: '/site.webmanifest' },
    ],
  }),
  loader: () => getBootstrap(),
  // Secure-by-default: a route that forgets to set its own `headers` still
  // ends up non-cacheable. `/sign-in` is the only one that opts out of this
  // by setting its own (a leaf route's headers win over the root's, per
  // @tanstack/router-core's header merge).
  headers: privatePageHeaders,
  shellComponent: RootDocument,
  component: RootLayout,
})

function RootLayout() {
  const { supabase, user } = Route.useLoaderData()
  const router = useRouter()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  useAuthSync(supabase, user?.id ?? null)

  return (
    // The padding makes room for the header: 3.5rem of nav plus its 1px border.
    <div className="flex min-h-screen flex-col pt-[calc(3.5rem+1px)] print:pt-0">
      {/* Fixed rather than sticky: a sticky header rides the overscroll bounce
          down with the page and bares the backdrop above it. Hidden in print,
          where a fixed element repeats over every page's content. */}
      <header className="fixed inset-x-0 top-0 z-10 border-b border-line bg-chrome shadow-md print:hidden">
        <nav className="flex h-14 items-center justify-between gap-4 px-2">
          <Link to="/" className="flex items-center">
            {/* Decorative: the wordmark beside it carries the name. Both are
                in the markup so the right one shows before hydration. */}
            <img
              src="/images/favicon-36x36-black.png"
              alt=""
              width={36}
              height={36}
              className="mr-2 ml-1 dark:hidden"
            />
            <img
              src="/images/favicon-36x36-white.png"
              alt=""
              width={36}
              height={36}
              className="mr-2 ml-1 hidden dark:block"
            />
            <span className="text-lg font-bold transition-colors hover:text-amber-500">
              Munda Manager Roleplay
            </span>
          </Link>
          <div className="mr-2 flex items-center gap-3 text-sm">
            <ThemeToggle />
            {user ? (
              <>
                <Link to="/tables" className="text-fg-muted hover:text-fg">
                  Tables
                </Link>
                <span className="text-fg-muted">{user.displayName}</span>
                <Button
                  type="button"
                  variant="secondary"
                  className="px-2 py-1 text-fg-muted"
                  onClick={async () => {
                    await signOut(supabase, router)
                    await router.navigate({ to: '/sign-in' })
                  }}
                >
                  Sign out
                </Button>
              </>
            ) : pathname === '/sign-in' ? null : (
              // The sign-in page already has the form; a link to the page you
              // are on is just noise.
              <Link to="/sign-in" className="text-fg-muted hover:text-fg">
                Sign in
              </Link>
            )}
          </div>
        </nav>
      </header>
      {/* Grows so the footer sits at the bottom of short pages. */}
      <div className="flex-1">
        <Outlet />
      </div>
      <Footer />
    </div>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    // The head script adds the theme class before React hydrates.
    <html lang="en" suppressHydrationWarning>
      <head>
        <ScriptOnce>{themeScript}</ScriptOnce>
        <HeadContent />
        {/* Here rather than in `head()`, which dedupes meta by name and would
            keep only one. They follow the OS rather than the in-app choice:
            browsers read them before any script runs. */}
        <meta name="theme-color" media="(prefers-color-scheme: light)" content="#f5f5f4" />
        <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#000000" />
      </head>
      <body className="text-fg antialiased">
        {children}
        {/* Statically false in production, so the panels drop out of the bundle. */}
        {import.meta.env.DEV && (
          <TanStackDevtools
            config={{ position: 'bottom-right' }}
            plugins={[{ name: 'TanStack Router', render: <TanStackRouterDevtoolsPanel /> }]}
          />
        )}
        <Scripts />
      </body>
    </html>
  )
}
