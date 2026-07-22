import {
  trackGaEvent as queueGaEvent,
  trackMetaEvent as queueMetaEvent,
} from './runtime'

export type CommerceAnalyticsEvent =
  | 'view_item'
  | 'add_to_cart'
  | 'begin_checkout'
  | 'add_payment_info'
  | 'select_payment'
  | 'purchase'
  | 'search'
  | 'add_to_wishlist'

export interface Ga4CommerceItem {
  item_id: string
  item_name: string
  affiliation?: string
  coupon?: string
  discount?: number
  index?: number
  item_brand?: string
  item_category?: string
  item_category2?: string
  item_category3?: string
  item_category4?: string
  item_category5?: string
  item_list_id?: string
  item_list_name?: string
  item_variant?: string
  location_id?: string
  price?: number
  quantity?: number
}

export type Ga4CommercePayload = {
  currency: string
  value: number
  items: Ga4CommerceItem[]
  coupon?: string
}

export type Ga4PurchasePayload = Ga4CommercePayload & {
  transaction_id: string
  affiliation?: string
  shipping?: number
  tax?: number
}

export type MetaCommercePayload = {
  content_ids: string[]
  content_type: 'product'
  contents: Array<{ id: string; quantity: number; item_price?: number }>
  value: number
  currency: string
  num_items: number
}

export interface CommerceItemInput {
  id: string
  name: string
  price?: number
  quantity?: number
  brand?: string
  category?: string
  category2?: string
  category3?: string
  category4?: string
  category5?: string
  variant?: string
  coupon?: string
  discount?: number
  index?: number
  listId?: string
  listName?: string
}

interface CommerceValueInput {
  value: number
  currency?: string
  numItems?: number
  items?: CommerceItemInput[]
  coupon?: string
}

export interface PurchaseAnalyticsInput extends CommerceValueInput {
  orderId?: string
  transactionId?: string
  shipping?: number
  tax?: number
  affiliation?: string
  verified?: boolean
}

const PURCHASE_STORAGE_KEY = 'splaro_analytics_purchases'
const trackedPurchases = new Set<string>()

function safeNumber(value: number | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function toGaItem(item: CommerceItemInput): Ga4CommerceItem {
  return {
    item_id: item.id,
    item_name: item.name,
    ...(item.brand ? { item_brand: item.brand } : {}),
    ...(item.category ? { item_category: item.category } : {}),
    ...(item.category2 ? { item_category2: item.category2 } : {}),
    ...(item.category3 ? { item_category3: item.category3 } : {}),
    ...(item.category4 ? { item_category4: item.category4 } : {}),
    ...(item.category5 ? { item_category5: item.category5 } : {}),
    ...(item.variant ? { item_variant: item.variant } : {}),
    ...(item.coupon ? { coupon: item.coupon } : {}),
    ...(item.listId ? { item_list_id: item.listId } : {}),
    ...(item.listName ? { item_list_name: item.listName } : {}),
    ...(safeNumber(item.discount) !== undefined ? { discount: item.discount } : {}),
    ...(safeNumber(item.index) !== undefined ? { index: item.index } : {}),
    ...(safeNumber(item.price) !== undefined ? { price: item.price } : {}),
    ...(safeNumber(item.quantity) !== undefined ? { quantity: item.quantity } : {}),
  }
}

function fallbackCartItem(value: number, numItems = 1): CommerceItemInput {
  const quantity = Math.max(1, numItems)
  return {
    id: 'cart',
    name: 'Cart',
    price: value / quantity,
    quantity,
  }
}

function resolveItems(input: CommerceValueInput): CommerceItemInput[] {
  return input.items?.length
    ? input.items
    : [fallbackCartItem(input.value, input.numItems)]
}

function itemCount(items: CommerceItemInput[]): number {
  return items.reduce((total, item) => total + Math.max(1, item.quantity ?? 1), 0)
}

function toMetaItems(items: CommerceItemInput[]) {
  return items.map((item) => ({
    id: item.id,
    quantity: Math.max(1, item.quantity ?? 1),
    ...(safeNumber(item.price) !== undefined ? { item_price: item.price } : {}),
  }))
}

function metaCommercePayload(
  items: CommerceItemInput[],
  value: number,
  currency: string,
): MetaCommercePayload {
  return {
    content_ids: items.map((item) => item.id),
    content_type: 'product',
    contents: toMetaItems(items),
    value,
    currency,
    num_items: itemCount(items),
  }
}

function wasPurchaseTracked(transactionId: string): boolean {
  if (trackedPurchases.has(transactionId)) return true
  if (typeof window === 'undefined') return false

  try {
    const stored = JSON.parse(window.localStorage.getItem(PURCHASE_STORAGE_KEY) ?? '[]') as unknown
    if (Array.isArray(stored) && stored.includes(transactionId)) {
      trackedPurchases.add(transactionId)
      return true
    }
  } catch {
    // Storage can be blocked; in-memory dedupe still applies.
  }
  return false
}

function rememberPurchase(transactionId: string): void {
  trackedPurchases.add(transactionId)
  if (typeof window === 'undefined') return

  try {
    const stored = JSON.parse(window.localStorage.getItem(PURCHASE_STORAGE_KEY) ?? '[]') as unknown
    const ids = Array.isArray(stored)
      ? stored.filter((value): value is string => typeof value === 'string')
      : []
    window.localStorage.setItem(
      PURCHASE_STORAGE_KEY,
      JSON.stringify([...new Set([...ids, transactionId])].slice(-100)),
    )
  } catch {
    // Storage can be blocked; in-memory dedupe still applies.
  }
}

export function trackMetaEvent(
  event: string,
  payload?: Record<string, unknown>,
  eventId?: string,
): void {
  queueMetaEvent(event, payload, eventId)
}

export function trackGaEvent(
  name: CommerceAnalyticsEvent | string,
  params?: Record<string, unknown>,
): void {
  queueGaEvent(name, params)
}

export function trackViewItem(input: CommerceItemInput): void {
  const item = toGaItem({ ...input, quantity: input.quantity ?? 1 })
  const currency = 'BDT'
  const value = input.price ?? 0
  queueGaEvent('view_item', { currency, value, items: [item] })
  queueMetaEvent('ViewContent', metaCommercePayload([input], value, currency))
}

export const trackViewContent = trackViewItem

export function trackAddToCart(input: CommerceItemInput): void {
  const item = { ...input, quantity: input.quantity ?? 1 }
  const currency = 'BDT'
  const value = (input.price ?? 0) * item.quantity
  queueGaEvent('add_to_cart', { currency, value, items: [toGaItem(item)] })
  queueMetaEvent('AddToCart', metaCommercePayload([item], value, currency))
}

export function trackBeginCheckout(input: CommerceValueInput): void {
  const currency = input.currency ?? 'BDT'
  const items = resolveItems(input)
  const payload: Ga4CommercePayload = {
    currency,
    value: input.value,
    items: items.map(toGaItem),
    ...(input.coupon ? { coupon: input.coupon } : {}),
  }
  queueGaEvent('begin_checkout', payload)
  queueMetaEvent('InitiateCheckout', metaCommercePayload(items, input.value, currency))
}

export const trackInitiateCheckout = trackBeginCheckout

export function trackAddPaymentInfo(
  input: CommerceValueInput & { paymentType: string },
): void {
  const currency = input.currency ?? 'BDT'
  const items = resolveItems(input)
  queueGaEvent('add_payment_info', {
    currency,
    value: input.value,
    payment_type: input.paymentType,
    items: items.map(toGaItem),
    ...(input.coupon ? { coupon: input.coupon } : {}),
  })
  queueMetaEvent('AddPaymentInfo', {
    ...metaCommercePayload(items, input.value, currency),
    payment_method: input.paymentType,
  })
}

export function trackSelectPayment(input: {
  paymentType: string
  value?: number
  currency?: string
  numItems?: number
  items?: CommerceItemInput[]
  coupon?: string
}): void {
  const value = input.value ?? 0
  const currency = input.currency ?? 'BDT'
  const items = resolveItems({ ...input, value })
  queueGaEvent('select_payment', {
    payment_type: input.paymentType,
    currency,
    value,
    items: items.map(toGaItem),
  })
  trackAddPaymentInfo({ ...input, value })
}

function trackGoogleAdsPurchase(input: {
  transactionId: string
  value: number
  currency: string
}): void {
  const adsId = (process.env.NEXT_PUBLIC_GOOGLE_ADS_ID ?? '').trim()
  const label = (process.env.NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL ?? '').trim()
  if (!adsId || !label || typeof window === 'undefined') return
  const sendTo = `${adsId}/${label}`
  try {
    window.gtag?.('event', 'conversion', {
      send_to: sendTo,
      value: input.value,
      currency: input.currency,
      transaction_id: input.transactionId,
    })
  } catch {
    // Ads tag optional — never block checkout UX.
  }
}

export function trackPurchase(input: PurchaseAnalyticsInput): void {
  const transactionId = (input.transactionId ?? input.orderId ?? '').trim()
  if (!transactionId || input.verified === false || wasPurchaseTracked(transactionId)) return

  const currency = input.currency ?? 'BDT'
  const items = resolveItems(input)
  rememberPurchase(transactionId)
  const payload: Ga4PurchasePayload = {
    transaction_id: transactionId,
    currency,
    value: input.value,
    items: items.map(toGaItem),
    ...(input.affiliation ? { affiliation: input.affiliation } : {}),
    ...(input.coupon ? { coupon: input.coupon } : {}),
    ...(safeNumber(input.shipping) !== undefined ? { shipping: input.shipping } : {}),
    ...(safeNumber(input.tax) !== undefined ? { tax: input.tax } : {}),
  }
  queueGaEvent('purchase', payload)
  queueMetaEvent('Purchase', {
    ...metaCommercePayload(items, input.value, currency),
    order_id: transactionId,
  }, transactionId)
  trackGoogleAdsPurchase({ transactionId, value: input.value, currency })
}

export function trackSearch(input: { query: string; resultCount?: number }): void {
  const query = input.query.trim()
  if (!query) return
  queueGaEvent('search', {
    search_term: query,
    ...(safeNumber(input.resultCount) !== undefined ? { result_count: input.resultCount } : {}),
  })
  queueMetaEvent('Search', {
    search_string: query,
    ...(safeNumber(input.resultCount) !== undefined ? { result_count: input.resultCount } : {}),
  })
}

export function trackAddToWishlist(input: CommerceItemInput): void {
  const item = { ...input, quantity: input.quantity ?? 1 }
  const currency = 'BDT'
  const value = (input.price ?? 0) * item.quantity
  queueGaEvent('add_to_wishlist', { currency, value, items: [toGaItem(item)] })
  queueMetaEvent('AddToWishlist', metaCommercePayload([item], value, currency))
}
