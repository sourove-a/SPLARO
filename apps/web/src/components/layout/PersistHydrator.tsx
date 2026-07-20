'use client'

import { useEffect, useRef } from 'react'
import { useAuthStore } from '@/store/authStore'
import { useCartStore } from '@/store/cartStore'
import { useWishlistStore } from '@/store/wishlistStore'

/**
 * Rehydrate persisted stores ASAP.
 * Cart/auth must not wait on requestIdleCallback — that delayed /cart
 * "Loading your bag…" by up to ~1.2s on every visit.
 */
export function PersistHydrator() {
  const syncedUserRef = useRef<string | null>(null)

  useEffect(() => {
    void useCartStore.persist.rehydrate()
    void useAuthStore.persist.rehydrate()

    const win = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
      cancelIdleCallback?: (id: number) => void
    }

    let idleId: number | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    const runWishlist = () => {
      void useWishlistStore.persist.rehydrate()
    }

    if (win.requestIdleCallback) {
      idleId = win.requestIdleCallback(runWishlist, { timeout: 400 })
    } else {
      timer = setTimeout(runWishlist, 0)
    }

    return () => {
      if (idleId !== undefined) win.cancelIdleCallback?.(idleId)
      if (timer !== undefined) clearTimeout(timer)
    }
  }, [])

  const authHydrated = useAuthStore((state) => state._hydrated)
  const user = useAuthStore((state) => state.user)
  const wishlistHydrated = useWishlistStore((state) => state._hydrated)
  const syncWithAccount = useWishlistStore((state) => state.syncWithAccount)

  useEffect(() => {
    if (!user) {
      syncedUserRef.current = null
      return
    }
    if (!authHydrated || !wishlistHydrated) return

    const userKey = user.id ?? user.email
    if (syncedUserRef.current === userKey) return
    syncedUserRef.current = userKey

    void syncWithAccount().catch(() => {
      // Allow a later authenticated mount to retry after a real network error.
      if (syncedUserRef.current === userKey) syncedUserRef.current = null
    })
  }, [authHydrated, wishlistHydrated, user, syncWithAccount])

  return null
}
