import { buildInvoiceAccessToken, getApiBaseUrl } from '@splaro/config'
import type { StoredOrder, StoredOrderItem } from '@/lib/server/store'

const STORE_ID = process.env.NEXT_PUBLIC_STORE_ID ?? 'splaro'

function internalApiHeaders(accept = 'application/json'): Record<string, string> {
  const headers: Record<string, string> = { Accept: accept }
  const secret = process.env.INTERNAL_HEALTH_SECRET
  if (secret) headers['x-splaro-internal'] = secret
  return headers
}

function normalizeApiOrderStatus(status: string): StoredOrder['status'] {
  const normalized = status.toLowerCase()
  const allowed: StoredOrder['status'][] = [
    'pending',
    'confirmed',
    'packed',
    'shipped',
    'in_transit',
    'delivered',
    'cancelled',
  ]
  return allowed.includes(normalized as StoredOrder['status'])
    ? (normalized as StoredOrder['status'])
    : 'confirmed'
}

export interface ApiCreateOrderInput {
  customer: {
    name: string
    email: string
    phone: string
    address: string
    city: string
  }
  items: StoredOrderItem[]
  subtotal: number
  delivery: number
  discount: number
  total: number
  paymentMethod: string
  couponCode?: string
  attribution?: {
    utmSource?: string
    utmMedium?: string
    utmCampaign?: string
    utmContent?: string
    utmTerm?: string
    fbclid?: string
    referrer?: string
    trafficSource?: string
    landingPage?: string
  }
  clientIp?: string
  userAgent?: string
}

function mapApiOrderToStored(order: {
  id: string
  invoiceNumber: string
  status: string
  createdAt: string | Date
  updatedAt: string | Date
  shippingName: string
  shippingPhone: string
  shippingAddress: string
  shippingCity: string
  subtotal: unknown
  deliveryCharge: unknown
  discount: unknown
  total: unknown
  paymentMethod: string
  paymentStatus: string
  customer?: { email?: string | null } | null
  items: {
    productName: string
    price: unknown
    quantity: number
    productId: string
    variantId?: string | null
    image?: string | null
    variantName?: string | null
  }[]
}): StoredOrder {
  const createdAt =
    typeof order.createdAt === 'string' ? order.createdAt : order.createdAt.toISOString()
  const updatedAt =
    typeof order.updatedAt === 'string' ? order.updatedAt : order.updatedAt.toISOString()

  return {
    id: order.id,
    invoiceNumber: order.invoiceNumber,
    invoiceAccessKey: buildInvoiceAccessToken(order.id),
    createdAt,
    updatedAt,
    status: normalizeApiOrderStatus(order.status),
    customer: {
      name: order.shippingName,
      email: order.customer?.email?.trim() ?? '',
      phone: order.shippingPhone,
      address: order.shippingAddress,
      city: order.shippingCity,
    },
    items: order.items.map((item) => ({
      productId: item.productId,
      ...(item.variantId ? { variantId: item.variantId } : {}),
      quantity: item.quantity,
      name: item.productName,
      price: Number(item.price),
      image: item.image ?? '',
      slug: '',
      ...(item.variantName?.split(' / ')[0] ? { size: item.variantName.split(' / ')[0] } : {}),
      ...(item.variantName?.split(' / ')[1] ? { color: item.variantName.split(' / ')[1] } : {}),
    })),
    subtotal: Number(order.subtotal),
    delivery: Number(order.deliveryCharge),
    discount: Number(order.discount),
    total: Number(order.total),
    payment: {
      method: order.paymentMethod,
      status: order.paymentStatus === 'PAID' ? 'paid' : 'pending',
    },
    tracking: {
      stage: order.status,
      updatedAt,
    },
  }
}

export async function createOrderViaApi(input: ApiCreateOrderInput): Promise<StoredOrder | null> {
  const base = getApiBaseUrl()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (input.clientIp) headers['X-Forwarded-For'] = input.clientIp
  if (input.userAgent) headers['User-Agent'] = input.userAgent

  const res = await fetch(`${base}/storefront/orders?storeId=${encodeURIComponent(STORE_ID)}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      storeId: STORE_ID,
      customer: {
        ...input.customer,
        district: input.customer.city,
        division: 'Dhaka',
      },
      items: input.items,
      subtotal: input.subtotal,
      delivery: input.delivery,
      discount: input.discount,
      total: input.total,
      paymentMethod: input.paymentMethod,
      couponCode: input.couponCode,
      ...(input.attribution ? { attribution: input.attribution } : {}),
    }),
    cache: 'no-store',
  })

  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as { message?: string | string[] } | null
    const message = Array.isArray(payload?.message)
      ? payload.message.join('; ')
      : payload?.message ?? `API order failed (${res.status})`
    throw new Error(message)
  }

  const payload = (await res.json()) as { order: Parameters<typeof mapApiOrderToStored>[0] }
  return mapApiOrderToStored(payload.order)
}

export async function fetchOrdersViaApi(phone: string): Promise<StoredOrder[]> {
  const base = getApiBaseUrl()
  const res = await fetch(
    `${base}/storefront/orders/track?storeId=${encodeURIComponent(STORE_ID)}&phone=${encodeURIComponent(phone)}`,
    { cache: 'no-store' },
  )
  if (!res.ok) return []
  const payload = (await res.json()) as { orders: Parameters<typeof mapApiOrderToStored>[0][] }
  return (payload.orders ?? []).map(mapApiOrderToStored)
}

export async function fetchOrderByIdViaApi(
  orderId: string,
  options?: { accessKey?: string | null | undefined; phone?: string | null | undefined },
): Promise<StoredOrder | null> {
  const base = getApiBaseUrl()

  const fetchOne = async (id: string): Promise<StoredOrder | null> => {
    try {
      const res = await fetch(`${base}/admin/orders/${encodeURIComponent(id)}`, {
        headers: internalApiHeaders(),
        cache: 'no-store',
      })
      if (!res.ok) return null
      const order = (await res.json()) as Parameters<typeof mapApiOrderToStored>[0]
      return mapApiOrderToStored(order)
    } catch {
      return null
    }
  }

  const direct = await fetchOne(orderId)
  if (direct) return direct

  if (orderId.includes('-')) {
    try {
      const res = await fetch(
        `${base}/admin/orders?storeId=${encodeURIComponent(STORE_ID)}&search=${encodeURIComponent(orderId)}&limit=1`,
        { headers: internalApiHeaders(), cache: 'no-store' },
      )
      if (res.ok) {
        const payload = (await res.json()) as {
          orders?: Parameters<typeof mapApiOrderToStored>[0][]
        }
        const match = payload.orders?.find(
          (order) => order.id === orderId || order.invoiceNumber === orderId,
        )
        if (match) return mapApiOrderToStored(match)
      }
    } catch {
      // fall through to storefront access lookup
    }
  }

  if (!options?.accessKey && !options?.phone) return null

  const params = new URLSearchParams({ storeId: STORE_ID })
  if (options.accessKey) params.set('key', options.accessKey)
  if (options.phone) params.set('phone', options.phone)

  try {
    const res = await fetch(
      `${base}/storefront/orders/${encodeURIComponent(orderId)}?${params.toString()}`,
      { cache: 'no-store' },
    )
    if (!res.ok) return null
    const payload = (await res.json()) as { order: Parameters<typeof mapApiOrderToStored>[0] }
    return mapApiOrderToStored(payload.order)
  } catch {
    return null
  }
}

export async function fetchInvoiceHtmlViaApi(
  orderId: string,
  options?: { autoPrint?: boolean },
): Promise<string | null> {
  const base = getApiBaseUrl()
  const path = options?.autoPrint
    ? `/admin/orders/${encodeURIComponent(orderId)}/invoice/print`
    : `/admin/orders/${encodeURIComponent(orderId)}/invoice`

  try {
    const res = await fetch(`${base}${path}`, {
      headers: internalApiHeaders('text/html'),
      cache: 'no-store',
    })
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
}
