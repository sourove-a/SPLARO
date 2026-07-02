'use client'

import { useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import { useAuthStore } from '@/store/authStore'
import { useCartStore } from '@/store/cartStore'
import { pullServerCart, pushCartToServer } from '@/lib/api/cart-sync'

export function CartSyncHydrator() {
  const user = useAuthStore((state) => state.user)
  const hydrated = useAuthStore((state) => state._hydrated)
  const cartHydrated = useCartStore((state) => state._hydrated)
  const items = useCartStore((state) => state.items)
  const replaceItems = useCartStore((state) => state.replaceItems)
  const hasPulledServerCart = useRef(false)
  const lastPushWarned = useRef(false)

  useEffect(() => {
    if (!hydrated || !cartHydrated || !user || hasPulledServerCart.current) return

    hasPulledServerCart.current = true
    void pullServerCart((serverItems) => {
      if (serverItems.length > 0) {
        replaceItems(serverItems)
      }
    }).then((result) => {
      if (!result.ok) {
        toast.error(result.error, { id: 'cart-sync-pull' })
      }
    })
  }, [hydrated, cartHydrated, user, replaceItems])

  useEffect(() => {
    if (!hydrated || !cartHydrated || !user) return
    void pushCartToServer(items).then((result) => {
      if (result.ok) {
        lastPushWarned.current = false
        return
      }
      if (lastPushWarned.current) return
      lastPushWarned.current = true
      toast.error(result.error, { id: 'cart-sync-push' })
    })
  }, [hydrated, cartHydrated, user, items])

  return null
}
