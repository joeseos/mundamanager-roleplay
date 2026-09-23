import { afterEach, describe, expect, it, vi } from 'vitest'

import { THEME_STORAGE_KEY, applyTheme, themeScript } from './theme.ts'

/** Just enough of the browser for applyTheme, which runs outside React. */
function fakeBrowser({ stored, osDark }: { stored?: string; osDark: boolean }) {
  const classes = new Set<string>()
  const root = {
    classList: {
      toggle: (name: string, on: boolean) => (on ? classes.add(name) : classes.delete(name)),
    },
  }
  const storage = new Map(stored === undefined ? [] : [[THEME_STORAGE_KEY, stored]])

  vi.stubGlobal('document', { documentElement: root })
  vi.stubGlobal('localStorage', { getItem: (key: string) => storage.get(key) ?? null })
  vi.stubGlobal('window', { matchMedia: () => ({ matches: osDark }) })
  return { classes }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('applyTheme', () => {
  it('applies a stored explicit choice regardless of the OS', () => {
    const { classes } = fakeBrowser({ stored: 'light', osDark: true })
    applyTheme(THEME_STORAGE_KEY)
    expect([...classes]).toEqual(['light'])
  })

  it('follows the OS when nothing is stored', () => {
    const { classes } = fakeBrowser({ osDark: true })
    applyTheme(THEME_STORAGE_KEY)
    expect([...classes]).toEqual(['dark'])
  })

  it('treats an unrecognised stored value as system', () => {
    const { classes } = fakeBrowser({ stored: 'purple', osDark: false })
    applyTheme(THEME_STORAGE_KEY)
    expect([...classes]).toEqual(['light'])
  })

  it('prefers an explicit argument over storage', () => {
    const { classes } = fakeBrowser({ stored: 'light', osDark: false })
    applyTheme(THEME_STORAGE_KEY, 'dark')
    expect([...classes]).toEqual(['dark'])
  })

  it('falls back to the OS when storage throws', () => {
    const { classes } = fakeBrowser({ osDark: true })
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('SecurityError')
      },
    })
    applyTheme(THEME_STORAGE_KEY)
    expect([...classes]).toEqual(['dark'])
  })
})

describe('themeScript', () => {
  it('runs on its own, with nothing from this module in scope', () => {
    const { classes } = fakeBrowser({ stored: 'dark', osDark: false })
    new Function(themeScript)()
    expect([...classes]).toEqual(['dark'])
  })
})
