import { NextResponse } from 'next/server'
import { resolveOrderById } from '@/lib/server/orders'
import { createPayment } from '@/lib/server/payments/bkash'
import { getClientKey, rateLimit } from '@/lib/server/rate-limit'

interface CreateBody {
  orderId?: string
  phone?: string
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
  if (!orderId) {
    return NextResponse.json({ error: 'orderId is required' }, { status: 400 })
  }

  const order = await resolveOrderById(orderId, { phone: body.phone?.trim() })
  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  const phone = body.phone?.trim() || order.customer.phone
  const result = await createPayment({
    orderId: order.id,
    invoiceNumber: order.invoiceNumber,
    amount: order.total,
    phone,
  })

  if (!result.success) {
    return NextResponse.json({ error: result.message }, { status: 503 })
  }

  return NextResponse.json(result)
}
