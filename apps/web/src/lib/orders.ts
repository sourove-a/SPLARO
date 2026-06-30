import type { CartItem } from '@/store/cartStore'
import { buildInvoiceUrl } from '@/lib/invoice-url'

export type DeliveryStage = 'Confirmed' | 'Packed' | 'Shipped' | 'In Transit' | 'Delivered'

export const DELIVERY_STAGES: DeliveryStage[] = [
  'Confirmed',
  'Packed',
  'Shipped',
  'In Transit',
  'Delivered',
]

export interface StoredOrder {
  id: string
  invoiceNumber?: string
  invoiceAccessKey?: string
  createdAt: string
  updatedAt?: string
  status?: string
  customer: {
    name: string
    email: string
    phone: string
    address: string
    city: string
    payment: string
  }
  items: CartItem[]
  subtotal: number
  delivery: number
  discount: number
  total: number
  tracking?: {
    stage?: string
    trackingNumber?: string
    url?: string
    updatedAt?: string
  }
}

interface ApiOrder {
  id: string
  invoiceNumber?: string
  invoiceAccessKey?: string
  createdAt: string
  updatedAt?: string
  status?: string
  customer: StoredOrder['customer']
  items: CartItem[]
  subtotal: number
  delivery: number
  discount: number
  total: number
  payment?: { method: string }
  tracking?: StoredOrder['tracking']
}

function normalizeOrder(order: ApiOrder): StoredOrder {
  return {
    id: order.id,
    ...(order.invoiceNumber ? { invoiceNumber: order.invoiceNumber } : {}),
    ...(order.invoiceAccessKey ? { invoiceAccessKey: order.invoiceAccessKey } : {}),
    createdAt: order.createdAt,
    ...(order.updatedAt ? { updatedAt: order.updatedAt } : {}),
    ...(order.status ? { status: order.status } : {}),
    customer: {
      ...order.customer,
      payment: order.customer.payment ?? order.payment?.method ?? 'Cash on Delivery',
    },
    items: order.items,
    subtotal: order.subtotal,
    delivery: order.delivery,
    discount: order.discount,
    total: order.total,
    ...(order.tracking ? { tracking: order.tracking } : {}),
  }
}

function mergeOrders(primary: StoredOrder[], secondary: StoredOrder[]): StoredOrder[] {
  const map = new Map<string, StoredOrder>()
  for (const order of [...secondary, ...primary]) {
    map.set(order.id, order)
  }
  return [...map.values()].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
}

export function saveOrderLocally(order: StoredOrder) {
  if (typeof window === 'undefined') return
  const existing = loadOrders()
  const next = [order, ...existing.filter((item) => item.id !== order.id)]
  window.localStorage.setItem('splaro-orders', JSON.stringify(next))
}

export function loadOrders(): StoredOrder[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(window.localStorage.getItem('splaro-orders') ?? '[]') as StoredOrder[]
  } catch {
    return []
  }
}

export async function fetchUserOrders(): Promise<StoredOrder[]> {
  try {
    const response = await fetch('/api/orders', { credentials: 'include' })
    if (!response.ok) return loadOrders()
    const payload = (await response.json()) as { orders?: ApiOrder[] }
    const orders = (payload.orders ?? []).map(normalizeOrder)
    if (orders.length) {
      window.localStorage.setItem('splaro-orders', JSON.stringify(orders))
    }
    return orders.length ? orders : loadOrders()
  } catch {
    return loadOrders()
  }
}

export async function fetchOrderById(orderIdOrInvoice: string): Promise<StoredOrder | null> {
  const local = loadOrders().find(
    (order) => order.id === orderIdOrInvoice || order.invoiceNumber === orderIdOrInvoice,
  )
  if (local) return local

  try {
    const response = await fetch(`/api/orders/${encodeURIComponent(orderIdOrInvoice)}`, {
      credentials: 'include',
    })
    if (!response.ok) return null
    const payload = (await response.json()) as { order?: ApiOrder }
    if (!payload.order) return null
    const order = normalizeOrder(payload.order)
    saveOrderLocally(order)
    return order
  } catch {
    return null
  }
}

export async function trackOrder(orderId: string, phone: string): Promise<StoredOrder | null> {
  const result = await trackOrdersByPhone(phone, orderId)
  if (!result.ok || !result.data.orders.length) return null
  return result.data.orders[0] ?? null
}

export interface TrackOrdersResult {
  orders: StoredOrder[]
  active: StoredOrder | null
  previous: StoredOrder[]
}

function mapTrackOrderPayload(raw: Record<string, unknown>): StoredOrder {
  const payment = raw.payment as { method?: string } | undefined
  const customer = raw.customer as StoredOrder['customer'] | undefined
  const tracking = raw.tracking as StoredOrder['tracking'] | undefined

  const mapped: StoredOrder = {
    id: String(raw.id),
    ...(raw.invoiceNumber ? { invoiceNumber: String(raw.invoiceNumber) } : {}),
    ...(raw.invoiceAccessKey ? { invoiceAccessKey: String(raw.invoiceAccessKey) } : {}),
    createdAt: String(raw.createdAt),
    ...(raw.updatedAt ? { updatedAt: String(raw.updatedAt) } : {}),
    ...(raw.status ? { status: String(raw.status) } : {}),
    customer: {
      name: customer?.name ?? '',
      email: customer?.email ?? '',
      phone: customer?.phone ?? '',
      address: customer?.address ?? '',
      city: customer?.city ?? '',
      payment:
        (customer as { payment?: string } | undefined)?.payment ??
        payment?.method ??
        'Cash on Delivery',
    },
    items: (raw.items as StoredOrder['items']) ?? [],
    subtotal: Number(raw.subtotal ?? 0),
    delivery: Number(raw.delivery ?? 0),
    discount: Number(raw.discount ?? 0),
    total: Number(raw.total ?? 0),
  }

  if (tracking) mapped.tracking = tracking
  return mapped
}

export async function trackOrdersByPhone(
  phone: string,
  orderNumber?: string,
): Promise<
  | { ok: true; data: TrackOrdersResult }
  | { ok: false; error: string; requiresOtp?: boolean }
> {
  try {
    const params = new URLSearchParams({ phone })
    if (orderNumber?.trim()) params.set('id', orderNumber.trim())
    const response = await fetch(`/api/orders/track?${params.toString()}`, {
      cache: 'no-store',
      credentials: 'include',
    })
    const payload = (await response.json()) as {
      orders?: Record<string, unknown>[]
      active?: Record<string, unknown> | null
      previous?: Record<string, unknown>[]
      error?: string
      requiresOtp?: boolean
    }

    if (!response.ok) {
      return {
        ok: false,
        error: payload.error ?? 'Could not find orders',
        ...(payload.requiresOtp ? { requiresOtp: true } : {}),
      }
    }

    const orders = (payload.orders ?? []).map(mapTrackOrderPayload)
    if (orders.length) {
      window.localStorage.setItem('splaro-orders', JSON.stringify(orders))
    }
    return {
      ok: true,
      data: {
        orders,
        active: payload.active ? mapTrackOrderPayload(payload.active) : null,
        previous: (payload.previous ?? []).map(mapTrackOrderPayload),
      },
    }
  } catch {
    const local = loadOrders().filter((order) => {
      const orderPhone = order.customer.phone.replace(/\D/g, '')
      const queryPhone = phone.replace(/\D/g, '')
      return orderPhone === queryPhone || orderPhone.slice(-10) === queryPhone.slice(-10)
    })
    if (!local.length) return { ok: false, error: 'No orders found' }
    const filtered = orderNumber?.trim()
      ? local.filter(
          (order) =>
            order.id.toLowerCase() === orderNumber.toLowerCase() ||
            order.invoiceNumber?.toLowerCase() === orderNumber.toLowerCase(),
        )
      : local
    if (!filtered.length) return { ok: false, error: 'No orders found' }
    const active =
      filtered.find((order) => {
        const status = order.status?.toLowerCase() ?? ''
        return status !== 'delivered' && status !== 'cancelled'
      }) ?? null
    return {
      ok: true,
      data: {
        orders: filtered,
        active,
        previous: filtered.filter((order) => order.id !== active?.id),
      },
    }
  }
}

function mapStatusToDeliveryStage(status: string): DeliveryStage | null {
  const normalized = status.trim().toUpperCase().replace(/-/g, '_')

  if (['DELIVERED'].includes(normalized)) return 'Delivered'
  if (['IN_TRANSIT', 'OUT_FOR_DELIVERY'].includes(normalized)) return 'In Transit'
  if (['SHIPPED', 'PICKED_UP', 'COURIER_BOOKED'].includes(normalized)) return 'Shipped'
  if (['PACKED', 'PROCESSING'].includes(normalized)) return 'Packed'
  if (['CONFIRMED', 'PENDING'].includes(normalized)) return 'Confirmed'
  if (['CANCELLED', 'RETURNED', 'REFUNDED'].includes(normalized)) return 'Confirmed'

  const lower = status.trim().toLowerCase()
  if (lower === 'delivered') return 'Delivered'
  if (lower === 'in_transit') return 'In Transit'
  if (lower === 'shipped') return 'Shipped'
  if (lower === 'packed') return 'Packed'
  if (lower === 'confirmed' || lower === 'pending') return 'Confirmed'

  return null
}

function mapTrackingLabel(stage: string): DeliveryStage | null {
  const normalized = stage.toLowerCase()
  if (normalized.includes('deliver')) return 'Delivered'
  if (normalized.includes('transit')) return 'In Transit'
  if (normalized.includes('ship')) return 'Shipped'
  if (normalized.includes('pack')) return 'Packed'
  if (normalized.includes('confirm') || normalized.includes('pending')) return 'Confirmed'
  return null
}

export function getDeliveryStage(
  _createdAt: string,
  trackingStage?: string,
  orderStatus?: string,
): DeliveryStage {
  if (orderStatus) {
    const fromStatus = mapStatusToDeliveryStage(orderStatus)
    if (fromStatus) return fromStatus
  }

  if (trackingStage) {
    const fromTracking = mapTrackingLabel(trackingStage)
    if (fromTracking) return fromTracking
  }

  return 'Confirmed'
}

export function isActiveOrder(stage: DeliveryStage) {
  return stage !== 'Delivered'
}

export function formatOrderDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function getOrderStats(orders: StoredOrder[]) {
  const stages = orders.map((order) =>
    getDeliveryStage(order.createdAt, order.tracking?.stage, order.status),
  )
  const active = stages.filter(isActiveOrder).length
  const delivered = stages.filter((stage) => stage === 'Delivered').length

  return {
    active,
    total: orders.length,
    delivered,
    returns: 0,
  }
}

export function getStageIndex(stage: DeliveryStage) {
  return DELIVERY_STAGES.indexOf(stage)
}

export function openOrderInvoice(orderOrId: string | StoredOrder) {
  if (typeof window === 'undefined') return
  const order =
    typeof orderOrId === 'string'
      ? loadOrders().find(
          (item) => item.id === orderOrId || item.invoiceNumber === orderOrId,
        )
      : orderOrId
  if (!order) return
  window.open(buildInvoiceUrl(order), '_blank', 'noopener,noreferrer')
}

export { mergeOrders, normalizeOrder }
