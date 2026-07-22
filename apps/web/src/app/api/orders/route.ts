import { NextResponse } from 'next/server'
import { apiAuthMe, getSessionToken } from '@/lib/server/api-auth'
import { validateCoupon } from '@/lib/server/coupons'
import { createOrderViaApi, fetchCustomerOrdersViaApi } from '@/lib/server/api-orders'
import { cacheOrderInFile } from '@/lib/server/orders'
import { getCheckoutShippingSettings } from '@/lib/storefront/settings'
import { getClientKey, rateLimit } from '@/lib/server/rate-limit'
import type { StoredOrderItem } from '@/lib/server/store'
import {
  DIGITAL_PAYMENT_DISCOUNT_RATE,
} from '@/lib/utils/currency'
import { isDigitalPayment, type PaymentMethod } from '@/lib/checkout/payments'
import { isBdDistrict } from '@/lib/checkout/bd-districts'
import { computeDeliveryFeeBdt } from '@/lib/checkout/shipping'
import { getBdPhoneError, normalizeBdPhone } from '@/lib/checkout/phone'
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
  idempotencyKey?: string
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
    gclid?: string
    fbp?: string
    fbc?: string
    referrer?: string
    trafficSource?: string
    landingPage?: string
  }
}

function isPaymentMethod(value: string): value is PaymentMethod {
  return ['Cash on Delivery', 'bKash', 'Nagad', 'SSLCommerz'].includes(value)
}

export async function GET() {
  const sessionToken = await getSessionToken()
  if (!sessionToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const apiOrders = await fetchCustomerOrdersViaApi(sessionToken)
    const orders = apiOrders.map(toClientOrder)
    return NextResponse.json({ orders })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load order history'
    return NextResponse.json({ error: message }, { status: 503 })
  }
}

export async function POST(request: Request) {
  const limit = await rateLimit(getClientKey(request, 'orders-create'), 8, 60_000)
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

  const paymentMethod = body.payment ?? 'Cash on Delivery'
  if (!isPaymentMethod(paymentMethod)) {
    return NextResponse.json({ error: 'Invalid payment method' }, { status: 400 })
  }

  // Guest COD is allowed — only digital payments require a signed-in customer.
  // Skip /auth/me for COD (Nest resolves the session token itself) to save a round-trip.
  const sessionToken = await getSessionToken()
  const needsSessionUser = isDigitalPayment(paymentMethod)
  const sessionUser = needsSessionUser && sessionToken ? await apiAuthMe(sessionToken) : null
  if (isDigitalPayment(paymentMethod)) {
    if (!sessionUser) {
      return NextResponse.json(
        { error: 'Sign in is required for online payment. Cash on Delivery works without an account.' },
        { status: 401 },
      )
    }
    if (process.env.NEXT_PUBLIC_DIGITAL_PAYMENTS_ENABLED !== 'true') {
      return NextResponse.json(
        { error: 'Online payment is not available yet. Please choose Cash on Delivery.' },
        { status: 400 },
      )
    }
  }

  const items = body.items ?? []
  const customer = body.customer
  const idempotencyKey = body.idempotencyKey?.trim()

  if (
    !idempotencyKey ||
    idempotencyKey.length < 16 ||
    idempotencyKey.length > 80 ||
    !/^[A-Za-z0-9_-]+$/.test(idempotencyKey)
  ) {
    return NextResponse.json({ error: 'A valid checkout idempotency key is required' }, { status: 400 })
  }

  if (!items.length) {
    return NextResponse.json({ error: 'Order must include at least one item' }, { status: 400 })
  }

  if (
    !customer?.name ||
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
    email: customer.email?.trim() ?? '',
    phone: normalizeBdPhone(customer.phone),
    address: customer.address.trim(),
    city: customer.city.trim(),
  }

  const subtotal =
    body.subtotal ??
    items.reduce((sum, item) => sum + item.price * item.quantity, 0)

  let couponDiscount = 0
  let couponFreeShipping = false
  // Shipping rates + optional coupon in parallel (Nest still re-validates both).
  const shippingPromise = getCheckoutShippingSettings()
  const couponPromise = body.couponCode
    ? validateCoupon(body.couponCode, subtotal)
    : Promise.resolve(null)

  const [shipping, couponResult] = await Promise.all([shippingPromise, couponPromise])
  if (couponResult) {
    if (!couponResult.valid) {
      return NextResponse.json({ error: couponResult.message }, { status: 400 })
    }
    couponDiscount = couponResult.discount
    couponFreeShipping = Boolean(couponResult.freeShipping)
  }

  const delivery = computeDeliveryFeeBdt(subtotal, normalizedCustomer.city, shipping, {
    freeShipping: couponFreeShipping,
  })

  const digitalDiscount = isDigitalPayment(paymentMethod)
    ? Math.round(subtotal * DIGITAL_PAYMENT_DISCOUNT_RATE)
    : 0

  const discount = body.discount ?? digitalDiscount + couponDiscount
  const total = Math.max(0, Math.round(subtotal + delivery - discount))

  const clientIp = getClientKey(request, 'ip').split(':').slice(1).join(':')
  const userAgent = request.headers.get('user-agent') ?? undefined

  try {
    const order = await createOrderViaApi({
      customer: {
        name: normalizedCustomer.name || sessionUser?.name || '',
        email: normalizedCustomer.email || sessionUser?.email || '',
        phone: normalizedCustomer.phone || sessionUser?.phone || '',
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
      idempotencyKey,
      ...(sessionToken ? { sessionToken } : {}),
    })

    if (!order) {
      throw new Error('Unable to create order')
    }

    // Dev file cache only — never block the place-order response.
    void cacheOrderInFile(order)

    return NextResponse.json({ order }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create order'
    const isApiDown =
      message.includes('fetch failed') ||
      message.includes('ECONNREFUSED') ||
      message.includes('API order failed')
    return NextResponse.json(
      {
        error: isApiDown
          ? 'Orders are temporarily unavailable. Please try again in a moment.'
          : message,
      },
      { status: isApiDown ? 503 : 400 },
    )
  }
}
