'use client'

import { useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'
import { useCartStore } from '@/store/cartStore'
import { pullServerCart, pushCartToServer } from '@/lib/api/cart-sync'

export function CartSyncHydrator() {
  const user = useAuthStore((state) => state.user)
  const hydrated = useAuthStore((state) => state._hydrated)
  const cartHydrated = useCartStore((state) => state._hydrated)
  const items = useCartStore((state) => state.items)
  const addItem = useCartStore((state) => state.addItem)

  useEffect(() => {
    if (!hydrated || !cartHydrated || !user) return

    void pullServerCart((serverItems) => {
      for (const item of serverItems) {
        addItem(item)
      }
    })
  }, [hydrated, cartHydrated, user, addItem])

  useEffect(() => {
    if (!hydrated || !cartHydrated || !user || items.length === 0) return
    void pushCartToServer(items)
  }, [hydrated, cartHydrated, user, items])

  return null
}
