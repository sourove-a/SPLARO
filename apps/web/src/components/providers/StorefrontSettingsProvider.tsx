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
    let idleId: number | null = null
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    const syncSettings = async () => {
      try {
        // Soft cache — SSR already hydrated chrome; this only picks up mid-session admin edits.
        const res = await fetch('/api/nav', {
          credentials: 'same-origin',
          // Allow BFCache / HTTP cache on Windows cold loads instead of forcing a network trip.
          cache: 'default',
        })
        if (!res.ok) return
        const data = (await res.json()) as { settings?: StorefrontSettings }
        if (cancelled || !data.settings) return
        setLive(data.settings)
      } catch {
        // Keep SSR/fallback shell settings — never blank the chrome.
      }
    }

    const schedule = () => {
      const win =
        typeof navigator !== 'undefined' && /Windows/i.test(navigator.userAgent || '')
      const delayMs = win ? 2500 : 400
      const run = () => {
        if (cancelled) return
        void syncSettings()
      }
      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        idleId = window.requestIdleCallback(run, { timeout: delayMs + 1500 })
      } else {
        timeoutId = setTimeout(run, delayMs)
      }
    }

    // Wait for first paint / load before competing with LCP on Windows Chrome.
    if (typeof document !== 'undefined' && document.readyState === 'complete') {
      schedule()
    } else if (typeof window !== 'undefined') {
      window.addEventListener('load', schedule, { once: true })
    } else {
      schedule()
    }

    return () => {
      cancelled = true
      if (idleId != null && typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
        window.cancelIdleCallback(idleId)
      }
      if (timeoutId) clearTimeout(timeoutId)
      if (typeof window !== 'undefined') {
        window.removeEventListener('load', schedule)
      }
    }
  }, [pathname, settings])

  return (
    <StorefrontSettingsContext.Provider value={live}>{children}</StorefrontSettingsContext.Provider>
  )
}

export function useStorefrontSettings() {
  return useContext(StorefrontSettingsContext)
}
