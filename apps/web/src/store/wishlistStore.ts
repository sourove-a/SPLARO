'use client'

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import toast from 'react-hot-toast'

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

type ToggleResult =
  | { ok: true; productIds: string[] | null; guest: boolean }
  | { ok: false; error: string }

async function postToggle(productId: string): Promise<ToggleResult> {
  const response = await fetch('/api/account/wishlist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ productId }),
  })
  // 401 = guest browsing — the wishlist lives on this device only, which is
  // expected and not an error.
  if (response.status === 401) return { ok: true, productIds: null, guest: true }
  if (!response.ok) {
    return { ok: false, error: `Wishlist could not be saved (${response.status})` }
  }
  const payload = (await response.json()) as { productIds?: string[] }
  return { ok: true, productIds: payload.productIds ?? null, guest: false }
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
          .then((result) => {
            if (result.ok) {
              if (result.productIds) set({ productIds: result.productIds })
              return
            }
            // API rejected the change — revert and tell the truth instead of
            // keeping a heart that was never saved.
            set({ productIds: previous })
            toast.error(result.error, { id: 'wishlist-toggle' })
          })
          .catch(() => {
            set({ productIds: previous })
            toast.error('Wishlist is offline — change was not saved.', { id: 'wishlist-toggle' })
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
