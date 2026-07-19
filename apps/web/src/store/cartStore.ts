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

function normPart(value?: string) {
  return (value ?? '').trim().toLowerCase()
}

function isHexColor(value: string) {
  return /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value.trim())
}

/** Prefer a human color name over a hex code when merging lines. */
function preferColorLabel(a?: string, b?: string): string | undefined {
  const ca = a?.trim() || undefined
  const cb = b?.trim() || undefined
  if (!ca) return cb
  if (!cb) return ca
  if (isHexColor(ca) && !isHexColor(cb)) return cb
  if (isHexColor(cb) && !isHexColor(ca)) return ca
  return ca
}

/**
 * Same bag line when product + size match and color/variant are compatible.
 * Empty color matches any (fixes Accessories quick-add omitting color vs PDP/shop).
 * Differing variantIds stay separate; hex vs name for the same pick merges.
 */
function sameCartLine(a: CartItem, b: Pick<CartItem, 'productId' | 'variantId' | 'size' | 'color'>) {
  if (a.productId !== b.productId) return false

  const sizeA = normPart(a.size)
  const sizeB = normPart(b.size)
  if (sizeA && sizeB && sizeA !== sizeB) return false

  const varA = a.variantId ?? ''
  const varB = b.variantId ?? ''
  if (varA && varB) return varA === varB

  const colorA = normPart(a.color)
  const colorB = normPart(b.color)
  if (!colorA || !colorB) return true
  if (colorA === colorB) return true
  // Hex from shop card vs name from PDP — treat as same line when size already matched.
  if (isHexColor(colorA) !== isHexColor(colorB)) return true
  return false
}

function mergeCartLine(existing: CartItem, incoming: CartItem): CartItem {
  const color = preferColorLabel(existing.color, incoming.color)
  return {
    ...existing,
    quantity: existing.quantity + incoming.quantity,
    ...(incoming.variantId && !existing.variantId ? { variantId: incoming.variantId } : {}),
    ...(incoming.size && !existing.size ? { size: incoming.size } : {}),
    ...(color ? { color } : {}),
    ...(!existing.image && incoming.image ? { image: incoming.image } : {}),
  }
}

export type CartLineRef = Pick<CartItem, 'productId' | 'variantId' | 'size' | 'color'>

export function cartLineKey(line: CartLineRef) {
  return `${line.productId}:${line.variantId ?? ''}:${line.size ?? ''}:${line.color ?? ''}`
}

export function toCartLineRef(item: CartItem): CartLineRef {
  return {
    productId: item.productId,
    ...(item.variantId !== undefined ? { variantId: item.variantId } : {}),
    ...(item.size !== undefined ? { size: item.size } : {}),
    ...(item.color !== undefined ? { color: item.color } : {}),
  }
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
  removeItem: (line: CartLineRef) => void
  updateQuantity: (line: CartLineRef, quantity: number) => void
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
          updated = items.map((i) => (sameCartLine(i, newItem) ? mergeCartLine(i, newItem) : i))
        } else {
          updated = [...items, newItem as CartItem]
        }

        set({ items: updated, ...cartTotals(updated) })
      },

      removeItem: (line) => {
        const updated = get().items.filter((i) => !sameCartLine(i, line))
        set({ items: updated, ...cartTotals(updated) })
      },

      updateQuantity: (line, quantity) => {
        if (quantity <= 0) {
          get().removeItem(line)
          return
        }
        const updated = get().items.map((i) =>
          sameCartLine(i, line) ? { ...i, quantity } : i,
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
