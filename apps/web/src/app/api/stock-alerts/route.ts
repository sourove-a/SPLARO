import { NextResponse } from 'next/server'
import { getServerApiBaseUrl } from '@splaro/config'
import { getSessionToken, sessionHeaders } from '@/lib/server/api-auth'
import { getClientKey, rateLimit } from '@/lib/server/rate-limit'
import { getTrustedClientIp } from '@/lib/server/client-ip'

const STORE_ID = process.env.NEXT_PUBLIC_STORE_ID ?? 'splaro'

function apiUrl(path: string): string {
  const base = getServerApiBaseUrl()
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

interface StockAlertBody {
  productId?: string
  variantId?: string
  email?: string
  phone?: string
}

/**
 * "Tell me when it's back." No sign-in required — the shopper who lands on an
 * out-of-stock page and is not signed in is exactly the one otherwise lost. The
 * session is forwarded when there is one, so the shop can see who is waiting.
 */
export async function POST(request: Request) {
  const limit = await rateLimit(getClientKey(request, 'stock-alert'))
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many requests', retryAfter: limit.retryAfter },
      { status: 429 },
    )
  }

  let body: StockAlertBody
  try {
    body = (await request.json()) as StockAlertBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.productId) {
    return NextResponse.json({ error: 'Product is required' }, { status: 400 })
  }
  if (!body.email && !body.phone) {
    return NextResponse.json(
      { error: 'Enter an email address or mobile number' },
      { status: 400 },
    )
  }

  const sessionToken = await getSessionToken()
  const response = await fetch(
    apiUrl(`/storefront/stock-alerts?storeId=${encodeURIComponent(STORE_ID)}`),
    {
      method: 'POST',
      headers: sessionHeaders(sessionToken, getTrustedClientIp(request)),
      body: JSON.stringify({
        productId: body.productId,
        ...(body.variantId ? { variantId: body.variantId } : {}),
        ...(body.email ? { email: body.email } : {}),
        ...(body.phone ? { phone: body.phone } : {}),
      }),
      cache: 'no-store',
    },
  )

  const payload = (await response.json().catch(() => ({}))) as {
    message?: string | string[]
  }
  if (!response.ok) {
    const message =
      typeof payload.message === 'string'
        ? payload.message
        : Array.isArray(payload.message)
          ? payload.message.join(', ')
          : 'Could not set up the alert'
    return NextResponse.json({ error: message }, { status: response.status })
  }

  return NextResponse.json(payload, { status: 201 })
}
