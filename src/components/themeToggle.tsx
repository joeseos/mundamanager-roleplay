import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import type { ReactNode, SVGProps } from 'react'

import { setThemePreference, useThemeSync } from '#/client/theme.ts'
import type { ThemePreference } from '#/client/theme.ts'

/*
 * A copy of Munda Manager's ThemeToggleDropdown (components/theme-toggle.tsx
 * there): same Radix menu, same Lucide glyphs, and its shadcn classes with the
 * popover/accent tokens spelled out as the neutral shades they resolve to.
 */

export function Icon({ children, ...props }: SVGProps<SVGSVGElement> & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      {children}
    </svg>
  )
}

function SunIcon({ className }: { className: string }) {
  return (
    <Icon className={className}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2m-7.07-17.07 1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </Icon>
  )
}

function MoonIcon({ className }: { className: string }) {
  return (
    <Icon className={className}>
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </Icon>
  )
}

function MonitorIcon({ className }: { className: string }) {
  return (
    <Icon className={className}>
      <rect width="20" height="14" x="2" y="3" rx="2" />
      <path d="M8 21h8m-4-4v4" />
    </Icon>
  )
}

const OPTIONS: ReadonlyArray<{
  value: ThemePreference
  label: string
  icon: (props: { className: string }) => ReactNode
}> = [
  { value: 'light', label: 'Light', icon: SunIcon },
  { value: 'dark', label: 'Dark', icon: MoonIcon },
  { value: 'system', label: 'System', icon: MonitorIcon },
]

/**
 * The trigger shows the applied theme through the `dark:` variant rather than
 * React state, so it is right from first paint and needs no mounted guard.
 */
export function ThemeToggle() {
  useThemeSync()

  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger
        aria-label="Toggle theme"
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-full transition-colors outline-hidden hover:bg-neutral-800 hover:text-white data-[state=open]:bg-neutral-800 data-[state=open]:text-white"
      >
        <SunIcon className="h-5 w-5 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
        <MoonIcon className="absolute h-5 w-5 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          className="z-50 min-w-[8rem] overflow-hidden rounded-md border border-neutral-200 bg-white p-1 text-neutral-950 shadow-md dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-50"
        >
          {OPTIONS.map(({ value, label, icon: OptionIcon }) => (
            <DropdownMenu.Item
              key={value}
              onSelect={() => setThemePreference(value)}
              className="relative flex cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-hidden transition-colors select-none focus:bg-neutral-100 dark:focus:bg-neutral-800"
            >
              <OptionIcon className="mr-2 h-4 w-4" />
              <span>{label}</span>
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
