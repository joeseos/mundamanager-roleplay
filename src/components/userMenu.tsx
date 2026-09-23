import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Link, useRouter } from '@tanstack/react-router'

import { signOut } from '#/client/auth.tsx'
import type { SupabaseConfig } from '#/client/supabase.ts'
import type { PublicUser } from '#/server/publicUser.ts'

import { SOCIALS } from './footer.tsx'
import { Icon } from './themeToggle.tsx'

/*
 * A trimmed copy of Munda Manager's SettingsModal (components/settings-modal.tsx
 * there): the same hamburger trigger and menu layout, keeping only what this
 * app has -- the username, Tables, the social links and Logout.
 */

const ITEM_CLASSES =
  'relative flex w-full cursor-pointer items-center rounded-sm px-2 py-1.5 text-sm outline-hidden transition-colors select-none'

/** Munda Manager's menu leaves Instagram to the footer. */
const MENU_SOCIALS = SOCIALS.filter(({ href }) => !href.includes('instagram.com'))

function Separator() {
  return <DropdownMenu.Separator className="-mx-1 my-1 h-px bg-neutral-100 dark:bg-neutral-800" />
}

function MenuIcon({ className }: { className: string }) {
  return (
    <Icon className={className}>
      <path d="M4 12h16M4 6h16M4 18h16" />
    </Icon>
  )
}

function TableIcon({ className }: { className: string }) {
  return (
    <Icon className={className}>
      <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18" />
    </Icon>
  )
}

function LogOutIcon({ className }: { className: string }) {
  return (
    <Icon className={className}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4m7 14 5-5-5-5m5 5H9" />
    </Icon>
  )
}

export function UserMenu({ user, supabase }: { user: PublicUser; supabase: SupabaseConfig }) {
  const router = useRouter()

  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger
        aria-label="Open Settings Menu"
        className="inline-flex h-10 w-10 items-center justify-center rounded-full transition-colors outline-hidden hover:bg-neutral-800 hover:text-white data-[state=open]:bg-neutral-800 data-[state=open]:text-white"
      >
        <MenuIcon className="h-5 w-5" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          collisionPadding={20}
          className="z-50 w-56 overflow-hidden rounded-md border border-neutral-200 bg-white p-1 text-neutral-950 shadow-md dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-50"
        >
          {/* A label rather than a link: there is no profile page here yet. */}
          <DropdownMenu.Label className="truncate px-2 py-1.5 text-xl font-medium">
            {user.displayName}
          </DropdownMenu.Label>

          <Separator />

          <DropdownMenu.Item
            asChild
            className={`${ITEM_CLASSES} focus:bg-neutral-100 dark:focus:bg-neutral-800`}
          >
            <Link to="/tables">
              <TableIcon className="mr-2 h-4 w-4" />
              Tables
            </Link>
          </DropdownMenu.Item>

          <Separator />

          <div className="flex gap-2 pb-1">
            {MENU_SOCIALS.map(({ label, href, viewBox, path }) => (
              <DropdownMenu.Item key={href} asChild>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="flex cursor-pointer items-center justify-center rounded-md px-2 py-1 text-sm outline-hidden transition-colors hover:bg-neutral-100 focus:bg-neutral-100 dark:hover:bg-neutral-800 dark:focus:bg-neutral-800"
                >
                  <svg viewBox={viewBox} fill="currentColor" className="h-4 w-4" aria-hidden>
                    <path d={path} />
                  </svg>
                </a>
              </DropdownMenu.Item>
            ))}
          </div>

          <Separator />

          <DropdownMenu.Item
            onSelect={async () => {
              await signOut(supabase, router)
              await router.navigate({ to: '/sign-in' })
            }}
            className={`${ITEM_CLASSES} text-red-500 focus:bg-red-100 focus:text-red-600 dark:focus:bg-red-900 dark:focus:text-red-400`}
          >
            <LogOutIcon className="mr-2 h-4 w-4" />
            Logout
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
