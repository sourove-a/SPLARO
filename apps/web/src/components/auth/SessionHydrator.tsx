'use client'

import { useEffect } from 'react'
import { useAuthStore, type AuthUser } from '@/store/authStore'

export function SessionHydrator() {
  const setUser = useAuthStore((state) => state.setUser)
  const setHydrated = useAuthStore((state) => state.setHydrated)

  useEffect(() => {
    const run = () => {
      fetch('/api/auth/me', { credentials: 'include' })
        .then(async (res) => {
          if (!res.ok) {
            setUser(null)
            return
          }

          const payload = (await res.json()) as { user?: AuthUser | null }
          setUser(payload?.user ?? null)
        })
        .catch(() => setUser(null))
        .finally(() => setHydrated())
    }

    const idleWindow = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
      cancelIdleCallback?: (id: number) => void
    }

    if (idleWindow.requestIdleCallback) {
      const id = idleWindow.requestIdleCallback(run, { timeout: 2000 })
      return () => idleWindow.cancelIdleCallback?.(id)
    }

    const timer = window.setTimeout(run, 0)
    return () => window.clearTimeout(timer)
  }, [setHydrated, setUser])

  return null
}
