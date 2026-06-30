import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/server/auth'
import { apiAuthMe, getSessionToken } from '@/lib/server/api-auth'
import { validateCoupon } from '@/lib/server/coupons'
import { sendOrderConfirmation } from '@/lib/server/notifications'
import { createOrderViaApi, fetchOrdersViaApi } from '@/lib/server/api-orders'
import { notifyStorefrontApiError } from '@/lib/server/api-events'
import { cacheOrderInFile, createOrder, getOrdersByUserId } from '@/lib/server/orders'
import { getStorefrontSettings } from '@/lib/storefront/settings'
import { getClientKey, rateLimit } from '@/lib/server/rate-limit'
import type { StoredOrderItem } from '@/lib/server/store'
import {
  DELIVERY_FEE_BDT,
  DIGITAL_PAYMENT_DISCOUNT_RATE,
} from '@/lib/utils/currency'
import { isDigitalPayment, type PaymentMethod } from '@/lib/checkout/payments'
import { isBdDistrict } from '@/lib/checkout/bd-districts'
import { getBdPhoneError, normalizeBdPhone } from '@/lib/checkout/phone'
import { mergeOrders } from '@/lib/orders'
import type { StoredOrder as ClientStoredOrder } from '@/lib/orders'
import type { StoredOrder as ServerStoredOrder } from '@/lib/server/store'

function toClientOrder(order: ServerStoredOrder): ClientStoredOrder {
  return {
    id: order.id,
    invoiceNumber: order.invoiceNumber,
    ...(order.invoiceAccessKey ? { invoiceAccessKey: order.invoiceAccessKey } : {}),
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    status: order.status,
    customer: {
      name: order.customer.name,
      email: order.customer.email,
      phone: order.customer.phone,
      address: order.customer.address,
      city: order.customer.city,
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
  }
}

interface CreateOrderBody {
  items?: StoredOrderItem[]
  customer?: {
    name?: string
    email?: string
    phone?: string
    address?: string
    city?: string
  }
  payment?: PaymentMethod
  couponCode?: string
  subtotal?: number
  delivery?: number
  discount?: number
  total?: number
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
}

function isPaymentMethod(value: string): value is PaymentMethod {
  return ['Cash on Delivery', 'bKash', 'Nagad', 'SSLCommerz'].includes(value)
}

export async function GET() {
  // Validate against the backend session (matches /api/auth/me) so a logged-in
  // customer's real orders load instead of always 401-ing on the legacy store.
  const sessionToken = await getSessionToken()
  const sessionUser = sessionToken ? await apiAuthMe(sessionToken) : null
  if (!sessionUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const localOrders = await getOrdersByUserId(sessionUser.id)
  const apiOrders = await fetchOrdersViaApi(sessionUser.phone)

  const orders = mergeOrders(
    localOrders.map(toClientOrder),
    apiOrders.map(toClientOrder),
  )

  return NextResponse.json({ orders })
}

export async function POST(request: Request) {
  const limit = await rateLimit(getClientKey(request, 'orders-create'), 20, 60_000)
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many requests', retryAfter: limit.retryAfter },
      { status: 429 },
    )
  }

  let body: CreateOrderBody
  try {
    body = (await request.json()) as CreateOrderBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const items = body.items ?? []
  const customer = body.customer

  if (!items.length) {
    return NextResponse.json({ error: 'Order must include at least one item' }, { status: 400 })
  }

  if (
    !customer?.name ||
    !customer.email ||
    !customer.phone ||
    !customer.address ||
    !customer.city
  ) {
    return NextResponse.json({ error: 'Complete customer details are required' }, { status: 400 })
  }

  const phoneError = getBdPhoneError(customer.phone)
  if (phoneError) {
    return NextResponse.json({ error: phoneError }, { status: 400 })
  }

  if (!isBdDistrict(customer.city.trim())) {
    return NextResponse.json({ error: 'Select a valid district' }, { status: 400 })
  }

  const normalizedCustomer = {
    name: customer.name.trim(),
    email: customer.email.trim(),
    phone: normalizeBdPhone(customer.phone),
    address: customer.address.trim(),
    city: customer.city.trim(),
  }

  const paymentMethod = body.payment ?? 'Cash on Delivery'
  if (!isPaymentMethod(paymentMethod)) {
    return NextResponse.json({ error: 'Invalid payment method' }, { status: 400 })
  }

  const subtotal =
    body.subtotal ??
    items.reduce((sum, item) => sum + item.price * item.quantity, 0)

  const settings = await getStorefrontSettings()
  const freeThreshold = settings.shipping.freeDeliveryThreshold

  let delivery =
    body.delivery ??
    (subtotal === 0 || (freeThreshold > 0 && subtotal >= freeThreshold) ? 0 : DELIVERY_FEE_BDT)

  let couponDiscount = 0
  if (body.couponCode) {
    const coupon = validateCoupon(body.couponCode, subtotal)
    if (!coupon.valid) {
      return NextResponse.json({ error: coupon.message }, { status: 400 })
    }
    couponDiscount = coupon.discount
    if (coupon.freeShipping) delivery = 0
  }

  const digitalDiscount = isDigitalPayment(paymentMethod)
    ? Math.round(subtotal * DIGITAL_PAYMENT_DISCOUNT_RATE)
    : 0

  const discount = body.discount ?? digitalDiscount + couponDiscount
  const total = body.total ?? Math.max(0, Math.round(subtotal + delivery - discount))

  const sessionUser = await getSessionUser()
  const clientIp = getClientKey(request, 'ip').split(':').slice(1).join(':')
  const userAgent = request.headers.get('user-agent') ?? undefined

  try {
    let order
    try {
      order = await createOrderViaApi({
        customer: {
          name: normalizedCustomer.name,
          email: normalizedCustomer.email,
          phone: normalizedCustomer.phone,
          address: normalizedCustomer.address,
          city: normalizedCustomer.city,
        },
        items,
        subtotal,
        delivery,
        discount,
        total,
        paymentMethod,
        ...(body.couponCode ? { couponCode: body.couponCode } : {}),
        ...(body.attribution ? { attribution: body.attribution } : {}),
        ...(clientIp !== 'local' ? { clientIp } : {}),
        ...(userAgent ? { userAgent } : {}),
      })
    } catch (apiErr) {
      void notifyStorefrontApiError(
        'Order create',
        apiErr instanceof Error ? apiErr.message : 'API order create failed — using local fallback',
      )
      order = await createOrder({
        ...(sessionUser?.id ? { userId: sessionUser.id } : {}),
        customer: {
          name: normalizedCustomer.name,
          email: normalizedCustomer.email,
          phone: normalizedCustomer.phone,
          address: normalizedCustomer.address,
          city: normalizedCustomer.city,
        },
        items,
        subtotal,
        delivery,
        discount,
        ...(body.couponCode ? { couponCode: body.couponCode, couponDiscount } : {}),
        total,
        paymentMethod,
      })
    }

    if (!order) {
      throw new Error('Unable to create order')
    }

    await cacheOrderInFile(order)

    await sendOrderConfirmation(order)

    return NextResponse.json({ order }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create order'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
