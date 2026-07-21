'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { usePathname } from 'next/navigation'
import {
  FALLBACK_SETTINGS,
  type NavLink,
  type StorefrontSettings,
} from '@/lib/storefront/settings'

const StorefrontSettingsContext = createContext<StorefrontSettings>(FALLBACK_SETTINGS)

function withHeaderNav(settings: StorefrontSettings, headerNav: NavLink[]): StorefrontSettings {
  return {
    ...settings,
    config: {
      ...settings.config,
      headerNav,
    },
  }
}

/**
 * Shared storefront settings. Re-fetches `/api/nav` after mount / route change so
 * Returns, Journal, Terms, etc. never keep a stale mega menu from an older layout payload.
 */
export function StorefrontSettingsProvider({
  settings,
  children,
}: {
  settings: StorefrontSettings
  children: ReactNode
}) {
  const pathname = usePathname()
  const [live, setLive] = useState(settings)

  useEffect(() => {
    setLive(settings)
  }, [settings])

  useEffect(() => {
    let cancelled = false

    const syncNav = async () => {
      try {
        const res = await fetch('/api/nav', { cache: 'no-store', credentials: 'same-origin' })
        if (!res.ok) return
        const data = (await res.json()) as { headerNav?: NavLink[] }
        if (cancelled || !data.headerNav?.length) return
        setLive((prev) => withHeaderNav(prev, data.headerNav!))
      } catch {
        // Keep SSR/fallback nav — never blank the chrome.
      }
    }

    void syncNav()
    return () => {
      cancelled = true
    }
  }, [pathname, settings])

  return (
    <StorefrontSettingsContext.Provider value={live}>{children}</StorefrontSettingsContext.Provider>
  )
}

export function useStorefrontSettings() {
  return useContext(StorefrontSettingsContext)
}
