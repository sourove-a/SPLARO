import { NextResponse } from 'next/server'
import { buildInvoiceAccessToken } from '@splaro/config'
import {
  apiTrackOrders,
  getPhoneAccessToken,
  getSessionToken,
} from '@/lib/server/api-auth'
import { getOrdersByPhone } from '@/lib/server/orders'
import type { StoredOrder } from '@/lib/orders'
import type { CartItem } from '@/store/cartStore'

function isTerminalOrder(order: StoredOrder) {
  const status = order.status?.toLowerCase() ?? ''
  return status === 'delivered' || status === 'cancelled'
}

function pickActiveOrder(orders: StoredOrder[]) {
  return orders.find((order) => !isTerminalOrder(order)) ?? null
}

function mapTrackItem(raw: Record<string, unknown>): CartItem {
  const name = String(raw.name ?? raw.productName ?? '').trim()
  return {
    productId: String(raw.productId ?? ''),
    ...(raw.variantId ? { variantId: String(raw.variantId) } : {}),
    quantity: Number(raw.quantity ?? 1),
    name: name || 'Item',
    price: Number(raw.price ?? 0),
    image: String(raw.image ?? ''),
    slug: String(raw.slug ?? ''),
    ...(raw.size ? { size: String(raw.size) } : {}),
    ...(raw.color ? { color: String(raw.color) } : {}),
  }
}

function mapApiOrder(raw: Record<string, unknown>): StoredOrder | null {
  const payment = raw.payment as { method?: string } | undefined
  const customer = raw.customer as StoredOrder['customer'] | undefined
  const tracking = raw.tracking as StoredOrder['tracking'] | undefined

  const publicId = String(raw.invoiceNumber ?? raw.orderCode ?? '').trim()
  if (!publicId || publicId === 'undefined') return null

  const accessKeyRaw = raw.invoiceAccessKey
  const invoiceAccessKey =
    typeof accessKeyRaw === 'string' && accessKeyRaw.trim()
      ? accessKeyRaw.trim()
      : buildInvoiceAccessToken(publicId)

  const rawItems = Array.isArray(raw.items) ? raw.items : []
  const mapped: StoredOrder = {
    id: publicId,
    invoiceNumber: publicId,
    invoiceAccessKey,
    createdAt: String(raw.createdAt),
    ...(raw.updatedAt ? { updatedAt: String(raw.updatedAt) } : {}),
    ...(raw.status ? { status: String(raw.status) } : {}),
    customer: {
      name: customer?.name ?? String(raw.shippingName ?? ''),
      email: customer?.email ?? String(raw.shippingEmail ?? ''),
      phone: customer?.phone ?? String(raw.shippingPhone ?? ''),
      address: customer?.address ?? String(raw.shippingAddress ?? ''),
      city: customer?.city ?? String(raw.shippingCity ?? ''),
      payment:
        (customer as { payment?: string } | undefined)?.payment ??
        payment?.method ??
        String(raw.paymentMethod ?? 'Cash on Delivery'),
    },
    items: rawItems.map((item) => mapTrackItem(item as Record<string, unknown>)),
    subtotal: Number(raw.subtotal ?? 0),
    delivery: Number(raw.delivery ?? raw.deliveryCharge ?? 0),
    discount: Number(raw.discount ?? 0),
    total: Number(raw.total ?? 0),
  }

  if (tracking && typeof tracking === 'object') {
    mapped.tracking = {
      ...(tracking.stage ? { stage: String(tracking.stage) } : {}),
      ...(tracking.trackingNumber ? { trackingNumber: String(tracking.trackingNumber) } : {}),
      ...(tracking.url ? { url: String(tracking.url) } : {}),
      ...(tracking.updatedAt ? { updatedAt: String(tracking.updatedAt) } : {}),
    }
  } else if (raw.status) {
    mapped.tracking = { stage: String(raw.status) }
  }

  return mapped
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const phone = searchParams.get('phone')?.trim()
  const orderRef =
    searchParams.get('id')?.trim() ||
    searchParams.get('order')?.trim() ||
    searchParams.get('invoice')?.trim()

  if (!phone) {
    return NextResponse.json({ error: 'Phone number is required' }, { status: 400 })
  }

  const normalizedPhone = phone.replace(/\D/g, '')
  if (normalizedPhone.length < 10) {
    return NextResponse.json({ error: 'Enter a valid phone number' }, { status: 400 })
  }

  const sessionToken = await getSessionToken()
  const phoneAccessToken = await getPhoneAccessToken()

  const trackResult = await apiTrackOrders(phone, {
    ...(sessionToken ? { sessionToken } : {}),
    ...(phoneAccessToken ? { phoneAccessToken } : {}),
  })

  let orders: StoredOrder[] = []

  if ('orders' in trackResult) {
    orders = trackResult.orders
      .map(mapApiOrder)
      .filter((order): order is StoredOrder => Boolean(order))
  } else {
    if (trackResult.requiresOtp) {
      return NextResponse.json(
        { error: trackResult.error, requiresOtp: true },
        { status: 401 },
      )
    }
    if (trackResult.status >= 500) {
      return NextResponse.json({ error: trackResult.error }, { status: trackResult.status })
    }
    if (trackResult.status === 401 || trackResult.status === 403) {
      return NextResponse.json({ error: trackResult.error }, { status: trackResult.status })
    }

    const localOrders = await getOrdersByPhone(phone)
    orders = localOrders.map((order) => ({
      id: order.id,
      invoiceNumber: order.invoiceNumber,
      ...(order.invoiceAccessKey ? { invoiceAccessKey: order.invoiceAccessKey } : {}),
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      status: order.status,
      customer: {
        ...order.customer,
        payment: order.payment.method,
      },
      items: order.items.map((item) => ({
        productId: item.productId,
        variantId: item.variantId ?? item.productId,
        quantity: item.quantity,
        name: item.name,
        price: item.price,
        image: item.image,
        slug: item.slug,
        ...(item.size ? { size: item.size } : {}),
        ...(item.color ? { color: item.color } : {}),
      })),
      subtotal: order.subtotal,
      delivery: order.delivery,
      discount: order.discount,
      total: order.total,
      ...(order.tracking ? { tracking: order.tracking } : {}),
    }))
  }

  if (orderRef) {
    const needle = orderRef.toLowerCase()
    orders = orders.filter(
      (order) =>
        order.id.toLowerCase() === needle ||
        order.invoiceNumber?.toLowerCase() === needle,
    )
  }

  if (!orders.length) {
    return NextResponse.json(
      { error: 'No orders found for this phone number' },
      { status: 404 },
    )
  }

  const active = pickActiveOrder(orders)
  const previous = orders.filter((order) => order.id !== active?.id)

  return NextResponse.json({ orders, active, previous })
}
