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

function sameCartLine(a: CartItem, b: Pick<CartItem, 'productId' | 'variantId' | 'size' | 'color'>) {
  return (
    a.productId === b.productId &&
    (a.variantId ?? '') === (b.variantId ?? '') &&
    (a.size ?? '') === (b.size ?? '') &&
    (a.color ?? '') === (b.color ?? '')
  )
}

function cartTotals(items: CartItem[]) {
  return {
    itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
    subtotal: items.reduce((sum, i) => sum + i.price * i.quantity, 0),
  }
}

interface CartStore {
  items: CartItem[]
  itemCount: number
  subtotal: number
  addItem: (item: CartItem) => void
  removeItem: (productId: string, variantId?: string) => void
  updateQuantity: (productId: string, variantId: string | undefined, quantity: number) => void
  replaceItems: (items: CartItem[]) => void
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
        const existing = items.find((i) => sameCartLine(i, newItem))

        let updated: CartItem[]
        if (existing) {
          updated = items.map((i) =>
            sameCartLine(i, newItem) ? { ...i, quantity: i.quantity + newItem.quantity } : i,
          )
        } else {
          updated = [...items, newItem as CartItem]
        }

        set({ items: updated, ...cartTotals(updated) })
      },

      removeItem: (productId, variantId) => {
        const updated = get().items.filter(
          (i) => !(i.productId === productId && (i.variantId ?? '') === (variantId ?? '')),
        )
        set({ items: updated, ...cartTotals(updated) })
      },

      updateQuantity: (productId, variantId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(productId, variantId)
          return
        }
        const updated = get().items.map((i) =>
          i.productId === productId && (i.variantId ?? '') === (variantId ?? '')
            ? { ...i, quantity }
            : i,
        )
        set({ items: updated, ...cartTotals(updated) })
      },

      replaceItems: (items) => {
        set({ items, ...cartTotals(items) })
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
