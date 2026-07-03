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
  const pullDone = useRef(false)
  const lastPushWarned = useRef(false)
  // Serializes pull → push: every sync operation is chained onto this
  // promise so a push can never race the initial pull (which used to wipe
  // the server cart with stale local items) or overlap another push.
  const syncQueue = useRef<Promise<void>>(Promise.resolve())

  useEffect(() => {
    if (!hydrated || !cartHydrated || !user || hasPulledServerCart.current) return

    hasPulledServerCart.current = true
    syncQueue.current = syncQueue.current.then(async () => {
      const result = await pullServerCart((serverItems) => {
        if (serverItems.length > 0) {
          replaceItems(serverItems)
        }
      })
      pullDone.current = true
      if (!result.ok) {
        toast.error(result.error, { id: 'cart-sync-pull' })
      }
    })
  }, [hydrated, cartHydrated, user, replaceItems])

  useEffect(() => {
    if (!hydrated || !cartHydrated || !user) return
    syncQueue.current = syncQueue.current.then(async () => {
      // Never push before the initial pull has merged the server cart —
      // pushing first would replace the server cart with stale local items.
      if (!pullDone.current) return
      const latestItems = useCartStore.getState().items
      const result = await pushCartToServer(latestItems)
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
