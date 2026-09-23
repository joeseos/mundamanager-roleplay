import { useEffect } from 'react'

export type ThemePreference = 'light' | 'dark' | 'system'

export const THEME_STORAGE_KEY = 'mundamanager-roleplay-theme'

const DARK_QUERY = '(prefers-color-scheme: dark)'

/**
 * Resolves the stored preference and sets the `dark` or `light` class on
 * `<html>`, which styles.css turns into `color-scheme` and with it every
 * colour token.
 *
 * Must stay self-contained -- no imports, no module constants -- because
 * `themeScript` serialises it with `toString()` to run before first paint.
 * `preference` skips the storage read, so a choice still applies when
 * localStorage is unavailable.
 */
export function applyTheme(storageKey: string, preference?: string | null): void {
  let pref = preference
  if (pref === undefined) {
    try {
      pref = localStorage.getItem(storageKey)
    } catch {
      pref = null
    }
  }

  const dark =
    pref === 'dark' ||
    (pref !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  const root = document.documentElement
  root.classList.toggle('dark', dark)
  root.classList.toggle('light', !dark)
}

/**
 * Runs from `<head>` before the body paints. The SSR HTML carries no theme at
 * all, which is what keeps `/sign-in` safe to edge-cache.
 */
export const themeScript = `(${applyTheme.toString()})(${JSON.stringify(THEME_STORAGE_KEY)})`

function toPreference(value: string | null): ThemePreference {
  return value === 'light' || value === 'dark' ? value : 'system'
}

/**
 * The choice in force on this page, as next-themes keeps it in state: storage
 * only persists it. Re-reading storage instead would lose a choice that could
 * not be saved. Null until the header toggle mounts and reads it.
 */
let currentPreference: ThemePreference | null = null

/**
 * Switches the theme with every transition suspended, as next-themes'
 * `disableTransitionOnChange` does for Munda Manager. Otherwise anything with
 * `transition-colors` (the wordmark, buttons) fades between the two palettes
 * while the rest of the page snaps, which reads as a flicker.
 */
function applyThemeInstantly(preference: ThemePreference): void {
  const style = document.createElement('style')
  style.textContent = '*,*::before,*::after{transition:none!important}'
  document.head.appendChild(style)

  applyTheme(THEME_STORAGE_KEY, preference)

  // Force a style recalc so the new colours land while transitions are off,
  // then restore them on the next task.
  void window.getComputedStyle(document.body).color
  setTimeout(() => style.remove(), 1)
}

export function setThemePreference(preference: ThemePreference): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference)
  } catch {
    // Private mode or blocked storage: the choice still applies to this page.
  }
  currentPreference = preference
  applyThemeInstantly(preference)
}

/**
 * Keeps the page in step after load: follows the OS while on `system`, and
 * picks up a choice made in another tab. Mounted once, from the header toggle.
 */
export function useThemeSync(): void {
  useEffect(() => {
    // Seed from what the head script applied, once: a re-run of the effect
    // must not overwrite a choice made since.
    if (currentPreference === null) {
      try {
        currentPreference = toPreference(localStorage.getItem(THEME_STORAGE_KEY))
      } catch {
        currentPreference = 'system'
      }
    }

    const media = window.matchMedia(DARK_QUERY)
    const onMediaChange = () => {
      // Only `system` depends on the OS, but re-applying the rest is harmless.
      applyThemeInstantly(currentPreference ?? 'system')
    }
    const onStorage = (event: StorageEvent) => {
      // A null key means storage was cleared outright.
      if (event.key !== null && event.key !== THEME_STORAGE_KEY) return
      currentPreference = toPreference(event.newValue)
      applyThemeInstantly(currentPreference)
    }

    media.addEventListener('change', onMediaChange)
    window.addEventListener('storage', onStorage)
    return () => {
      media.removeEventListener('change', onMediaChange)
      window.removeEventListener('storage', onStorage)
    }
  }, [])
}
