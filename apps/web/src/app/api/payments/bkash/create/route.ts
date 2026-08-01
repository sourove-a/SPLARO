import { NextResponse } from 'next/server'
import { verifyInvoiceAccessToken } from '@splaro/config'
import { resolveOrderById } from '@/lib/server/orders'
import { createPayment } from '@/lib/server/payments/bkash'
import { getClientKey, rateLimit } from '@/lib/server/rate-limit'

interface CreateBody {
  orderId?: string
  accessKey?: string
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
  const limit = await rateLimit(getClientKey(request, 'payments-bkash-create'))
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many requests', retryAfter: limit.retryAfter },
      { status: 429 },
    )
  }

  let body: CreateBody
  try {
    body = (await request.json()) as CreateBody
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

  const result = await createPayment({
    orderId: order.id,
    invoiceNumber: order.invoiceNumber,
    amount: order.total,
    phone: order.customer.phone,
  })

  if (!result.success) {
    return NextResponse.json({ error: result.message }, { status: 503 })
  }

  return NextResponse.json(result)
}
