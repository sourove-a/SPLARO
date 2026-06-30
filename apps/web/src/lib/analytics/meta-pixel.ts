declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void
    gtag?: (...args: unknown[]) => void
  }
}

export function trackMetaEvent(
  event: 'ViewContent' | 'AddToCart' | 'InitiateCheckout' | 'Purchase',
  payload?: Record<string, unknown>,
) {
  if (typeof window === 'undefined' || typeof window.fbq !== 'function') return
  window.fbq('track', event, payload ?? {})
}

export function trackGaEvent(name: string, params?: Record<string, unknown>) {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return
  window.gtag('event', name, params ?? {})
}

export function trackAddToCart(input: {
  id: string
  name: string
  price: number
  quantity?: number
}) {
  const payload = {
    content_ids: [input.id],
    content_name: input.name,
    content_type: 'product',
    value: input.price * (input.quantity ?? 1),
    currency: 'BDT',
    num_items: input.quantity ?? 1,
  }
  trackMetaEvent('AddToCart', payload)
  trackGaEvent('add_to_cart', payload)
}

export function trackInitiateCheckout(input: { value: number; numItems: number }) {
  const payload = { value: input.value, currency: 'BDT', num_items: input.numItems }
  trackMetaEvent('InitiateCheckout', payload)
  trackGaEvent('begin_checkout', payload)
}

export function trackPurchase(input: {
  orderId: string
  value: number
  numItems: number
}) {
  const payload = {
    value: input.value,
    currency: 'BDT',
    num_items: input.numItems,
    order_id: input.orderId,
  }
  trackMetaEvent('Purchase', payload)
  trackGaEvent('purchase', payload)
}

export function trackViewContent(input: { id: string; name: string; price: number }) {
  const payload = {
    content_ids: [input.id],
    content_name: input.name,
    content_type: 'product',
    value: input.price,
    currency: 'BDT',
  }
  trackMetaEvent('ViewContent', payload)
  trackGaEvent('view_item', payload)
}
