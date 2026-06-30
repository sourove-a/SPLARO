import { NextResponse } from 'next/server'
import { markOrderPaid } from '@/lib/server/orders'
import { validateIPN } from '@/lib/server/payments/sslcommerz'

function payloadFromForm(formData: FormData): Record<string, string> {
  const payload: Record<string, string> = {}

  for (const [key, value] of formData.entries()) {
    if (typeof value === 'string') payload[key] = value
  }

  return payload
}

export async function POST(request: Request) {
  let payload: Record<string, string> = {}

  const contentType = request.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    try {
      payload = (await request.json()) as Record<string, string>
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
  } else {
    const formData = await request.formData()
    payload = payloadFromForm(formData)
  }

  const result = await validateIPN(payload)
  if (!result.valid || !result.orderId) {
    return NextResponse.json({ error: result.message }, { status: 400 })
  }

  if (result.transactionId) {
    await markOrderPaid(result.orderId, result.transactionId)
  }

  return NextResponse.json(result)
}
