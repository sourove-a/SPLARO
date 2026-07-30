'use client'

import { useTheme } from 'next-themes'
import { useCallback, useEffect, useState } from 'react'

export type DcTheme = 'light' | 'dark'

export const ADMIN_THEME_STORAGE_KEY = 'splaro-admin-theme'

/**
 * Single apply path for admin theme.
 * Keeps DC shell (`data-t`) and foundation tokens (`html.dark`) in lockstep.
 */
export function applyAdminTheme(theme: DcTheme): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (theme === 'dark') {
    root.setAttribute('data-t', 'dark')
    root.classList.add('dark')
  } else {
    root.removeAttribute('data-t')
    root.classList.remove('dark')
  }
  try {
    localStorage.setItem(ADMIN_THEME_STORAGE_KEY, theme)
  } catch {
    // Private-mode storage failures must not break the toggle.
  }
}

/** True when both DOM signals already match `theme`. */
export function isAdminThemeApplied(theme: DcTheme): boolean {
  if (typeof document === 'undefined') return theme === 'light'
  const root = document.documentElement
  const wantsDark = theme === 'dark'
  return (
    (root.getAttribute('data-t') === 'dark') === wantsDark &&
    root.classList.contains('dark') === wantsDark
  )
}

export function readAppliedTheme(): DcTheme {
  if (typeof document === 'undefined') return 'light'
  const root = document.documentElement
  if (root.getAttribute('data-t') === 'dark' || root.classList.contains('dark')) return 'dark'
  return 'light'
}

/**
 * Applies the persisted theme to <html data-t> + .dark before first paint
 * so the dark shell never flashes light. Rendered once in the admin layout head.
 */
export function DcThemeScript() {
  const key = JSON.stringify(ADMIN_THEME_STORAGE_KEY)
  const script = `(function(){try{var t=localStorage.getItem(${key});if(t!=='dark'&&t!=='light'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}var r=document.documentElement;if(t==='dark'){r.setAttribute('data-t','dark');r.classList.add('dark');}else{r.removeAttribute('data-t');r.classList.remove('dark');}}catch(e){}})();`
  return <script dangerouslySetInnerHTML={{ __html: script }} />
}

export function useDcTheme() {
  const { setTheme: setNextTheme } = useTheme()
  const [theme, setThemeState] = useState<DcTheme>('light')

  // The pre-paint script is the source of truth; sync React to it after mount.
  useEffect(() => {
    const applied = readAppliedTheme()
    // Heal any data-t / .dark desync left from older toggles.
    if (!isAdminThemeApplied(applied)) applyAdminTheme(applied)
    setThemeState(applied)
  }, [])

  const setTheme = useCallback(
    (next: DcTheme) => {
      applyAdminTheme(next)
      setNextTheme(next)
      setThemeState(next)
    },
    [setNextTheme],
  )

  const toggleTheme = useCallback(() => {
    setTheme(readAppliedTheme() === 'dark' ? 'light' : 'dark')
  }, [setTheme])

  return { theme, setTheme, toggleTheme }
}
