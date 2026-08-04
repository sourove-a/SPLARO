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
  type StorefrontSettings,
} from '@/lib/storefront/settings'

const StorefrontSettingsContext = createContext<StorefrontSettings>(FALLBACK_SETTINGS)

/**
 * Shared storefront settings. Re-fetches live shell settings after mount / route
 * change so header and footer stay in sync with admin edits in the same session.
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

    const syncSettings = async () => {
      try {
        const res = await fetch('/api/nav', { cache: 'no-store', credentials: 'same-origin' })
        if (!res.ok) return
        const data = (await res.json()) as { settings?: StorefrontSettings }
        if (cancelled || !data.settings) return
        setLive(data.settings)
      } catch {
        // Keep SSR/fallback shell settings — never blank the chrome.
      }
    }

    void syncSettings()
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
