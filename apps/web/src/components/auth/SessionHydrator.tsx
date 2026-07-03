'use client'

import { useLayoutEffect } from 'react'
import { useAuthStore } from '@/store/authStore'
import { reconcileAuthSession } from '@/lib/api/session'

export function SessionHydrator() {
  const setUser = useAuthStore((state) => state.setUser)
  const setHydrated = useAuthStore((state) => state.setHydrated)

  useLayoutEffect(() => {
    let cancelled = false

    reconcileAuthSession()
      .then((serverUser) => {
        if (cancelled) return
        if (serverUser === null) {
          setUser(null)
        } else {
          setUser(serverUser)
        }
      })
      .catch(() => {
        // Network/API outage — keep cached user; account page surfaces connection errors.
      })
      .finally(() => {
        if (!cancelled) setHydrated()
      })

    return () => {
      cancelled = true
    }
  }, [setHydrated, setUser])

  return null
}
