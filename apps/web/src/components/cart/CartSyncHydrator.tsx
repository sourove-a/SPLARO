'use client'

import { useCallback, useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import { useAuthStore } from '@/store/authStore'
import { useCartStore } from '@/store/cartStore'
import { pullServerCart, pushCartToServer } from '@/lib/api/cart-sync'

const PULL_RETRY_MS = 2500
const PULL_MAX_RETRIES = 3
const PUSH_TOAST_COOLDOWN_MS = 45_000

function shouldNotifyCartSyncFailure(): boolean {
  const user = useAuthStore.getState().user
  const items = useCartStore.getState().items
  return Boolean(user) || items.length > 0
}

export function CartSyncHydrator() {
  const userId = useAuthStore((state) => state.user?.id)
  const hydrated = useAuthStore((state) => state._hydrated)
  const cartHydrated = useCartStore((state) => state._hydrated)
  const items = useCartStore((state) => state.items)
  const replaceItems = useCartStore((state) => state.replaceItems)

  const syncQueue = useRef<Promise<void>>(Promise.resolve())
  const pullReady = useRef(false)
  const pullAttempts = useRef(0)
  const pullRetryTimer = useRef<number | undefined>(undefined)
  const lastPushToastAt = useRef(0)

  const enqueue = useCallback((task: () => Promise<void>) => {
    syncQueue.current = syncQueue.current.then(task).catch(() => {})
  }, [])

  const schedulePull = useCallback(() => {
    if (pullReady.current) return

    enqueue(async () => {
      const result = await pullServerCart((serverItems) => {
        if (serverItems.length > 0) {
          replaceItems(serverItems)
        }
      })

      if (result.ok) {
        pullReady.current = true
        pullAttempts.current = 0
        return
      }

      pullAttempts.current += 1
      if (pullAttempts.current === 1 && shouldNotifyCartSyncFailure()) {
        toast.error(result.error, { id: 'cart-sync-pull' })
      }

      if (pullAttempts.current >= PULL_MAX_RETRIES) {
        pullReady.current = true
        return
      }

      window.clearTimeout(pullRetryTimer.current)
      pullRetryTimer.current = window.setTimeout(() => {
        schedulePull()
      }, PULL_RETRY_MS)
    })
  }, [enqueue, replaceItems])

  useEffect(() => {
    if (!hydrated || !cartHydrated) return

    pullReady.current = false
    pullAttempts.current = 0
    window.clearTimeout(pullRetryTimer.current)
    schedulePull()

    return () => {
      window.clearTimeout(pullRetryTimer.current)
    }
  }, [hydrated, cartHydrated, userId, schedulePull])

  useEffect(() => {
    if (!hydrated || !cartHydrated || !pullReady.current) return

    enqueue(async () => {
      const result = await pushCartToServer(useCartStore.getState().items)
      if (result.ok) return
      if (!shouldNotifyCartSyncFailure()) return

      const now = Date.now()
      if (now - lastPushToastAt.current > PUSH_TOAST_COOLDOWN_MS) {
        lastPushToastAt.current = now
        toast.error(result.error, { id: 'cart-sync-push' })
      }
    })
  }, [hydrated, cartHydrated, items, enqueue])

  return null
}
