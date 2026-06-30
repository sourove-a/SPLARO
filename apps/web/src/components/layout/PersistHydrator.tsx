'use client'

import { useEffect, useLayoutEffect } from 'react'
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
  useLayoutEffect(() => {
    rehydrateStores()
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
