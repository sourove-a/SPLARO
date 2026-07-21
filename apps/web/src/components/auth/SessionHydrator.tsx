'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'
import { reconcileAuthSession } from '@/lib/api/session'
import { safeClientNavigate } from '@/lib/navigation/safe-client-navigate'

const CRITICAL_AUTH_PATH =
  /^\/(checkout|cart|account|login|signup|forgot-password|reset-password)(\/|$)/

const NEEDS_PHONE_GATE =
  /^\/(checkout|account)(\/|$)/

/** Survives soft route changes — prevents duplicate /api/auth/me while first reconcile is in flight. */
let softNavSessionStarted = false

/**
 * Hydrate `/api/auth/me` after paint.
 * Home: defer until interaction or longer idle (cuts first-load fetch waterfall).
 * Checkout/cart/account/auth: run immediately so session is ready.
 */
export function SessionHydrator() {
  const pathname = usePathname()
  const router = useRouter()
  const setUser = useAuthStore((state) => state.setUser)
  const setHydrated = useAuthStore((state) => state.setHydrated)

  useEffect(() => {
    let cancelled = false
    const criticalPath = CRITICAL_AUTH_PATH.test(pathname ?? '')

    // Root provider survives soft navigation. Once session was reconciled
    // (or a non-critical reconcile already started), skip repeated /api/auth/me.
    if (!criticalPath && (useAuthStore.getState()._hydrated || softNavSessionStarted)) return
    if (!criticalPath) softNavSessionStarted = true

    const applyUser = (serverUser: Awaited<ReturnType<typeof reconcileAuthSession>>) => {
      if (cancelled) return
      if (serverUser === null) {
        setUser(null)
        return
      }
      setUser(serverUser)
      // Incomplete Google signup — finish phone before account/checkout.
      if (serverUser.needsPhone && NEEDS_PHONE_GATE.test(pathname ?? '')) {
        safeClientNavigate(router, '/signup', 'replace')
      }
    }

    const run = () => {
      reconcileAuthSession()
        .then(applyUser)
        .catch(() => {
          // Network/API outage — keep cached user; account page surfaces connection errors.
          if (!criticalPath) softNavSessionStarted = false
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
    const cleanups: Array<() => void> = []

    const clearSchedulers = () => {
      if (idleId !== undefined) win.cancelIdleCallback?.(idleId)
      if (timer !== undefined) clearTimeout(timer)
      idleId = undefined
      timer = undefined
    }

    if (criticalPath) {
      // Unblock checkout/cart UI immediately — don't wait on /api/auth/me RTT.
      setHydrated()
      run()
      return () => {
        cancelled = true
        clearSchedulers()
      }
    }

    if (pathname === '/') {
      let started = false
      const start = () => {
        if (started || cancelled) return
        started = true
        clearSchedulers()
        for (const off of cleanups) off()
        cleanups.length = 0
        run()
      }

      const onInteract = () => start()
      for (const evt of ['pointerdown', 'keydown', 'touchstart', 'scroll'] as const) {
        window.addEventListener(evt, onInteract, { once: true, passive: true })
        cleanups.push(() => window.removeEventListener(evt, onInteract))
      }

      // Bag continuity: if a cart session exists, hydrate sooner without blocking LCP.
      const hasCartSession =
        typeof window !== 'undefined' && Boolean(window.localStorage.getItem('splaro-cart-session'))
      timer = setTimeout(start, hasCartSession ? 2000 : 8000)

      return () => {
        cancelled = true
        clearSchedulers()
        for (const off of cleanups) off()
      }
    }

    if (win.requestIdleCallback) {
      idleId = win.requestIdleCallback(run, { timeout: 2500 })
    } else {
      timer = setTimeout(run, 800)
    }

    return () => {
      cancelled = true
      clearSchedulers()
    }
  }, [pathname, router, setHydrated, setUser])

  return null
}
