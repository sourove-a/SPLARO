'use client'

import { useLayoutEffect } from 'react'
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

  return null
}
