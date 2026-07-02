import { NextResponse } from 'next/server'
import { getApiBaseUrl } from '@splaro/config'
import { getClientKey, rateLimit } from '@/lib/server/rate-limit'

const STORE_ID = process.env.NEXT_PUBLIC_STORE_ID ?? 'splaro'

interface ValidateBody {
  code?: string
  subtotal?: number
}

export async function POST(request: Request) {
  const limit = await rateLimit(getClientKey(request, 'coupons-validate'))
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many requests', retryAfter: limit.retryAfter },
      { status: 429 },
    )
  }

  let body: ValidateBody
  try {
    body = (await request.json()) as ValidateBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const code = body.code?.trim()
  const subtotal = Number(body.subtotal ?? 0)

  if (!code) {
    return NextResponse.json({ error: 'Coupon code is required' }, { status: 400 })
  }

  if (!Number.isFinite(subtotal) || subtotal < 0) {
    return NextResponse.json({ error: 'Valid subtotal is required' }, { status: 400 })
  }

  try {
    const base = getApiBaseUrl()
    const res = await fetch(`${base}/storefront/coupons/validate?storeId=${encodeURIComponent(STORE_ID)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, subtotal }),
      cache: 'no-store',
    })
    const result = await res.json()
    return NextResponse.json(result, { status: res.status })
  } catch {
    return NextResponse.json(
      { valid: false, message: 'Coupon service offline — start API and try again' },
      { status: 503 },
    )
  }
}
