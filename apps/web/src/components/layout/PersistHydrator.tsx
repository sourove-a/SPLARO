'use client'

import { useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'
import { useCartStore } from '@/store/cartStore'
import { useWishlistStore } from '@/store/wishlistStore'

function rehydrateStores() {
  void Promise.all([
    useCartStore.persist.rehydrate(),
    useAuthStore.persist.rehydrate(),
    useWishlistStore.persist.rehydrate(),
  ])
}

export function PersistHydrator() {
  useEffect(() => {
    const win = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
      cancelIdleCallback?: (id: number) => void
    }

    let idleId: number | undefined
    let timer: ReturnType<typeof setTimeout> | undefined

    const run = () => rehydrateStores()

    if (win.requestIdleCallback) {
      idleId = win.requestIdleCallback(run, { timeout: 1200 })
    } else {
      timer = setTimeout(run, 0)
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
    if (!authHydrated || !wishlistHydrated || !user) return
    void syncWithAccount()
  }, [authHydrated, wishlistHydrated, user, syncWithAccount])

  return null
}
