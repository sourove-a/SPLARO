import { NextResponse } from 'next/server'
import { buildInvoiceAccessToken } from '@splaro/config'
import {
  apiTrackOrders,
  getPhoneAccessToken,
  getSessionToken,
} from '@/lib/server/api-auth'
import { getOrdersByPhone } from '@/lib/server/orders'
import type { StoredOrder } from '@/lib/orders'

function isPhoneOtpEnabled(): boolean {
  return process.env.STOREFRONT_PHONE_OTP_ENABLED === 'true'
}

function isTerminalOrder(order: StoredOrder) {
  const status = order.status?.toLowerCase() ?? ''
  return status === 'delivered' || status === 'cancelled'
}

function pickActiveOrder(orders: StoredOrder[]) {
  return orders.find((order) => !isTerminalOrder(order)) ?? null
}

function mapApiOrder(raw: Record<string, unknown>): StoredOrder {
  const payment = raw.payment as { method?: string } | undefined
  const customer = raw.customer as StoredOrder['customer'] | undefined
  const tracking = raw.tracking as StoredOrder['tracking'] | undefined

  const id = String(raw.id)
  const mapped: StoredOrder = {
    id,
    ...(raw.invoiceNumber ? { invoiceNumber: String(raw.invoiceNumber) } : {}),
    invoiceAccessKey: String(raw.invoiceAccessKey ?? buildInvoiceAccessToken(id)),
    createdAt: String(raw.createdAt),
    ...(raw.updatedAt ? { updatedAt: String(raw.updatedAt) } : {}),
    ...(raw.status ? { status: String(raw.status) } : {}),
    customer: {
      name: customer?.name ?? String(raw.shippingName ?? ''),
      email: customer?.email ?? '',
      phone: customer?.phone ?? String(raw.shippingPhone ?? ''),
      address: customer?.address ?? String(raw.shippingAddress ?? ''),
      city: customer?.city ?? String(raw.shippingCity ?? ''),
      payment:
        (customer as { payment?: string } | undefined)?.payment ??
        payment?.method ??
        String(raw.paymentMethod ?? 'Cash on Delivery'),
    },
    items: (raw.items as StoredOrder['items']) ?? [],
    subtotal: Number(raw.subtotal ?? 0),
    delivery: Number(raw.delivery ?? raw.deliveryCharge ?? 0),
    discount: Number(raw.discount ?? 0),
    total: Number(raw.total ?? 0),
  }

  if (tracking) mapped.tracking = tracking
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

  let orders: StoredOrder[] = []

  const apiOrders = await apiTrackOrders(phone, {
    ...(sessionToken ? { sessionToken } : {}),
    ...(phoneAccessToken ? { phoneAccessToken } : {}),
  })

  if (apiOrders) {
    orders = apiOrders.map(mapApiOrder)
  } else if (isPhoneOtpEnabled() && !phoneAccessToken && !sessionToken) {
    return NextResponse.json(
      { error: 'Phone verification required', requiresOtp: true },
      { status: 401 },
    )
  } else {
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
