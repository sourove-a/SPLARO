import { NextResponse } from 'next/server'
import { getServerApiBaseUrl } from '@splaro/config'
import { getClientKey, rateLimit } from '@/lib/server/rate-limit'
import { sessionHeaders } from '@/lib/server/api-auth'
import { getTrustedClientIp } from '@/lib/server/client-ip'

const STORE_ID = process.env.NEXT_PUBLIC_STORE_ID ?? 'splaro'

function apiUrl(path: string): string {
  const base = getServerApiBaseUrl()
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

/** Backs the one-click link in the alert email. No sign-in, by design. */
export async function POST(request: Request) {
  const limit = await rateLimit(getClientKey(request, 'stock-alert-unsub'))
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many requests', retryAfter: limit.retryAfter },
      { status: 429 },
    )
  }

  let token = ''
  try {
    token = String(((await request.json()) as { token?: string }).token ?? '')
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  if (!token.trim()) {
    return NextResponse.json({ error: 'Missing unsubscribe token' }, { status: 400 })
  }

  const response = await fetch(
    apiUrl(`/storefront/stock-alerts/unsubscribe?storeId=${encodeURIComponent(STORE_ID)}`),
    {
      method: 'POST',
      headers: sessionHeaders(undefined, getTrustedClientIp(request)),
      body: JSON.stringify({ token }),
      cache: 'no-store',
    },
  )

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    return NextResponse.json({ error: 'Could not remove the reminder' }, { status: response.status })
  }

  return NextResponse.json(payload, { status: 200 })
}
