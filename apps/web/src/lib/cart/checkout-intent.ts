import type { CartItem } from '@/store/cartStore'

const CHECKOUT_ITEMS_KEY = 'splaro-checkout-items'

/** Persist buy-now lines across auth navigation before zustand persist finishes. */
export function stageCheckoutItems(items: CartItem[]): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(CHECKOUT_ITEMS_KEY, JSON.stringify(items))
  } catch {
    /* storage full / private mode */
  }
}

export function consumeStagedCheckoutItems(): CartItem[] | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(CHECKOUT_ITEMS_KEY)
    if (!raw) return null
    sessionStorage.removeItem(CHECKOUT_ITEMS_KEY)
    const parsed = JSON.parse(raw) as CartItem[]
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null
  } catch {
    return null
  }
}

export function clearStagedCheckoutItems(): void {
  if (typeof window === 'undefined') return
  sessionStorage.removeItem(CHECKOUT_ITEMS_KEY)
}
