import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export interface CartItem {
  productId: string
  variantId?: string
  quantity: number
  name: string
  price: number
  image: string
  size?: string
  color?: string
  slug: string
}

interface CartStore {
  items: CartItem[]
  itemCount: number
  subtotal: number
  addItem: (item: CartItem) => void
  removeItem: (productId: string, variantId?: string) => void
  updateQuantity: (productId: string, variantId: string | undefined, quantity: number) => void
  clearCart: () => void
  _hydrated: boolean
  setHydrated: () => void
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      itemCount: 0,
      subtotal: 0,
      _hydrated: false,

      setHydrated: () => set({ _hydrated: true }),

      addItem: (newItem) => {
        const items = get().items
        const existing = items.find(
          (i) => i.productId === newItem.productId && i.variantId === newItem.variantId,
        )

        let updated: CartItem[]
        if (existing) {
          updated = items.map((i) =>
            i.productId === newItem.productId && i.variantId === newItem.variantId
              ? { ...i, quantity: i.quantity + newItem.quantity }
              : i,
          )
        } else {
          // Items added here will have name/price/image populated via API in production
          // For now we store what we have
          updated = [...items, newItem as CartItem]
        }

        set({
          items: updated,
          itemCount: updated.reduce((sum, i) => sum + i.quantity, 0),
          subtotal: updated.reduce((sum, i) => sum + i.price * i.quantity, 0),
        })
      },

      removeItem: (productId, variantId) => {
        const updated = get().items.filter(
          (i) => !(i.productId === productId && i.variantId === variantId),
        )
        set({
          items: updated,
          itemCount: updated.reduce((sum, i) => sum + i.quantity, 0),
          subtotal: updated.reduce((sum, i) => sum + i.price * i.quantity, 0),
        })
      },

      updateQuantity: (productId, variantId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(productId, variantId)
          return
        }
        const updated = get().items.map((i) =>
          i.productId === productId && i.variantId === variantId ? { ...i, quantity } : i,
        )
        set({
          items: updated,
          itemCount: updated.reduce((sum, i) => sum + i.quantity, 0),
          subtotal: updated.reduce((sum, i) => sum + i.price * i.quantity, 0),
        })
      },

      clearCart: () => set({ items: [], itemCount: 0, subtotal: 0 }),
    }),
    {
      name: 'splaro-cart',
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      onRehydrateStorage: () => (state) => {
        state?.setHydrated()
      },
    },
  ),
)
