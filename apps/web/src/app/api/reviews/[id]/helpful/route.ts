import { NextResponse } from 'next/server'
import { getApiBaseUrl } from '@splaro/config'
import { getClientKey, rateLimit } from '@/lib/server/rate-limit'

const STORE_ID = process.env.NEXT_PUBLIC_STORE_ID ?? 'splaro'

function apiUrl(path: string): string {
  const base = getApiBaseUrl()
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const limit = await rateLimit(getClientKey(_request, 'review-helpful'))
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many requests', retryAfter: limit.retryAfter },
      { status: 429 },
    )
  }

  const { id } = await context.params
  const response = await fetch(
    apiUrl(`/storefront/reviews/${encodeURIComponent(id)}/helpful?storeId=${encodeURIComponent(STORE_ID)}`),
    { method: 'POST', cache: 'no-store' },
  )

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    return NextResponse.json(
      { error: 'Could not register vote' },
      { status: response.status },
    )
  }

  return NextResponse.json(payload)
}
