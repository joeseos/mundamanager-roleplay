import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'

import TanStackQueryDevtools from '../integrations/tanstack-query/devtools'
import { signOut, useAuthSync } from '#/client/auth.tsx'
import { Button } from '#/components/button.tsx'
import { getBootstrap } from '#/server/fn/session.ts'

import appCss from '../styles.css?url'

import type { QueryClient } from '@tanstack/react-query'

/** Kept in step with the `body::before` rule in styles.css. */
const BACKGROUND_URL = '/background_numv5r.avif'

interface RouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Munda Manager Roleplay' },
      { name: 'theme-color', content: '#000000' },
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
  shellComponent: RootDocument,
  component: RootLayout,
})

function RootLayout() {
  const { supabase, user } = Route.useLoaderData()
  const router = useRouter()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  useAuthSync(supabase, user?.id ?? null)

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-stone-800 bg-stone-950 shadow-md">
        <nav className="flex h-14 items-center justify-between gap-4 px-2">
          <Link to="/" className="flex items-center">
            {/* Decorative: the wordmark beside it carries the name. */}
            <img
              src="/images/favicon-36x36-white.png"
              alt=""
              width={36}
              height={36}
              className="mr-2 ml-1"
            />
            <span className="text-lg font-bold transition-colors hover:text-amber-500">
              Munda Manager Roleplay
            </span>
          </Link>
          {user ? (
            <div className="mr-2 flex items-center gap-3 text-sm">
              <Link to="/tables" className="text-stone-300 hover:text-stone-100">
                Tables
              </Link>
              <span className="text-stone-300">{user.displayName}</span>
              <Button
                type="button"
                variant="secondary"
                className="px-2 py-1 text-stone-300"
                onClick={async () => {
                  await signOut(supabase)
                  await router.navigate({ to: '/login' })
                }}
              >
                Sign out
              </Button>
            </div>
          ) : pathname === '/login' ? null : (
            // The login page already has the form; a link to the page you are
            // on is just noise.
            <Link to="/login" className="mr-2 text-sm text-stone-300 hover:text-stone-100">
              Sign in
            </Link>
          )}
        </nav>
      </header>
      <Outlet />
    </div>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="text-stone-100 antialiased">
        {children}
        {/* Statically false in production, so the panels drop out of the bundle. */}
        {import.meta.env.DEV && (
          <TanStackDevtools
            config={{ position: 'bottom-right' }}
            plugins={[
              { name: 'TanStack Router', render: <TanStackRouterDevtoolsPanel /> },
              TanStackQueryDevtools,
            ]}
          />
        )}
        <Scripts />
      </body>
    </html>
  )
}
