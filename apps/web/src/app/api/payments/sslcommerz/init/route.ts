import { NextResponse } from 'next/server'
import { verifyInvoiceAccessToken } from '@splaro/config'
import { resolveOrderById } from '@/lib/server/orders'
import { initPayment } from '@/lib/server/payments/sslcommerz'
import { getClientKey, rateLimit } from '@/lib/server/rate-limit'

interface InitBody {
  orderId?: string
  accessKey?: string
  customer?: {
    name?: string
    email?: string
    phone?: string
    address?: string
    city?: string
  }
}

function hasValidAccessKey(
  order: { id: string; invoiceNumber: string },
  accessKey: string | undefined,
): boolean {
  if (!accessKey?.trim()) return false
  return (
    verifyInvoiceAccessToken(order.id, accessKey) ||
    verifyInvoiceAccessToken(order.invoiceNumber, accessKey)
  )
}

export async function POST(request: Request) {
  const limit = await rateLimit(getClientKey(request, 'payments-ssl-init'))
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many requests', retryAfter: limit.retryAfter },
      { status: 429 },
    )
  }

  let body: InitBody
  try {
    body = (await request.json()) as InitBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const orderId = body.orderId?.trim()
  const accessKey = body.accessKey?.trim()
  if (!orderId) {
    return NextResponse.json({ error: 'orderId is required' }, { status: 400 })
  }
  if (!accessKey) {
    return NextResponse.json({ error: 'accessKey is required' }, { status: 403 })
  }

  const order = await resolveOrderById(orderId, { accessKey })
  if (!order || !hasValidAccessKey(order, accessKey)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const result = await initPayment({
    orderId: order.id,
    invoiceNumber: order.invoiceNumber,
    amount: order.total,
    customer: {
      name: body.customer?.name?.trim() || order.customer.name,
      email: body.customer?.email?.trim() || order.customer.email,
      phone: body.customer?.phone?.trim() || order.customer.phone,
      address: body.customer?.address?.trim() || order.customer.address,
      city: body.customer?.city?.trim() || order.customer.city,
    },
  })

  if (!result.success) {
    return NextResponse.json({ error: result.message }, { status: 503 })
  }

  return NextResponse.json(result)
}
