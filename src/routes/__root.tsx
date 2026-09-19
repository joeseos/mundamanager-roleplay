import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRouteWithContext,
  useRouter,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'

import TanStackQueryDevtools from '../integrations/tanstack-query/devtools'
import { signOut, useAuthSync } from '#/client/auth.tsx'
import { getBootstrap } from '#/server/fn/session.ts'

import appCss from '../styles.css?url'

import type { QueryClient } from '@tanstack/react-query'

interface RouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Necromunda Roleplay' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  loader: () => getBootstrap(),
  shellComponent: RootDocument,
  component: RootLayout,
})

function RootLayout() {
  const { supabase, user } = Route.useLoaderData()
  const router = useRouter()
  useAuthSync(supabase, user?.id ?? null)

  return (
    <div className="min-h-screen">
      <header className="border-b border-stone-800">
        <nav className="mx-auto flex max-w-4xl items-center justify-between gap-4 p-4">
          <Link to="/" className="font-semibold tracking-tight">
            Necromunda Roleplay
          </Link>
          {user ? (
            <div className="flex items-center gap-3 text-sm">
              <Link to="/tables" className="text-stone-300 hover:text-stone-100">
                Tables
              </Link>
              <span className="text-stone-400">{user.displayName}</span>
              <button
                type="button"
                className="rounded border border-stone-700 px-2 py-1 text-stone-300 hover:bg-stone-800"
                onClick={async () => {
                  await signOut(supabase)
                  await router.navigate({ to: '/login' })
                }}
              >
                Sign out
              </button>
            </div>
          ) : (
            <Link to="/login" className="text-sm text-stone-300 hover:text-stone-100">
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
      <body className="bg-stone-950 text-stone-100 antialiased">
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
