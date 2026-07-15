'use client'

import { useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'
import { reconcileAuthSession } from '@/lib/api/session'

export function SessionHydrator() {
  const setUser = useAuthStore((state) => state.setUser)
  const setHydrated = useAuthStore((state) => state.setHydrated)

  useEffect(() => {
    let cancelled = false

    const run = () => {
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
    }

    const win = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
      cancelIdleCallback?: (id: number) => void
    }

    let idleId: number | undefined
    let timer: ReturnType<typeof setTimeout> | undefined

    if (win.requestIdleCallback) {
      idleId = win.requestIdleCallback(run, { timeout: 2500 })
    } else {
      timer = setTimeout(run, 800)
    }

    return () => {
      cancelled = true
      if (idleId !== undefined) win.cancelIdleCallback?.(idleId)
      if (timer !== undefined) clearTimeout(timer)
    }
  }, [setHydrated, setUser])

  return null
}
