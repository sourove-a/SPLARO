'use client'

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface WishlistStore {
  productIds: string[]
  _hydrated: boolean
  _syncing: boolean
  setHydrated: () => void
  setProductIds: (productIds: string[]) => void
  toggleWishlist: (productId: string) => void
  isInWishlist: (productId: string) => boolean
  clearWishlist: () => void
  syncWithAccount: () => Promise<void>
}

async function postToggle(productId: string): Promise<string[] | null> {
  const response = await fetch('/api/account/wishlist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ productId }),
  })
  if (!response.ok) return null
  const payload = (await response.json()) as { productIds?: string[] }
  return payload.productIds ?? null
}

export const useWishlistStore = create<WishlistStore>()(
  persist(
    (set, get) => ({
      productIds: [],
      _hydrated: false,
      _syncing: false,
      setHydrated: () => set({ _hydrated: true }),
      setProductIds: (productIds) => set({ productIds }),

      toggleWishlist: (productId) => {
        const previous = get().productIds
        const wasSaved = previous.includes(productId)
        const optimistic = wasSaved
          ? previous.filter((id) => id !== productId)
          : [...previous, productId]
        set({ productIds: optimistic })

        void postToggle(productId)
          .then((productIds) => {
            if (productIds) set({ productIds })
          })
          .catch(() => {
            set({ productIds: previous })
          })
      },

      isInWishlist: (productId) => get().productIds.includes(productId),

      clearWishlist: () => set({ productIds: [] }),

      syncWithAccount: async () => {
        if (get()._syncing) return
        set({ _syncing: true })
        try {
          const localIds = get().productIds
          const response = await fetch('/api/account/wishlist', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ productIds: localIds }),
          })
          if (!response.ok) return
          const payload = (await response.json()) as { productIds?: string[] }
          if (payload.productIds) set({ productIds: payload.productIds })
        } finally {
          set({ _syncing: false })
        }
      },
    }),
    {
      name: 'splaro-wishlist',
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (state) => ({ productIds: state.productIds }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated()
      },
    },
  ),
)
