import { NextResponse } from 'next/server'
import { getApiBaseUrl } from '@splaro/config'
import { apiAuthMe, getSessionToken, sessionHeaders } from '@/lib/server/api-auth'
import { getClientKey, rateLimit } from '@/lib/server/rate-limit'

const STORE_ID = process.env.NEXT_PUBLIC_STORE_ID ?? 'splaro'

function apiUrl(path: string): string {
  const base = getApiBaseUrl()
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

async function requireSession() {
  const sessionToken = await getSessionToken()
  if (!sessionToken) return null
  const user = await apiAuthMe(sessionToken)
  if (!user) return null
  return { sessionToken, user }
}

interface CreateReviewBody {
  productId?: string
  rating?: number
  title?: string
  body?: string
}

export async function POST(request: Request) {
  const limit = await rateLimit(getClientKey(request, 'reviews-create'))
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many requests', retryAfter: limit.retryAfter },
      { status: 429 },
    )
  }

  const session = await requireSession()
  if (!session) {
    return NextResponse.json({ error: 'Sign in to leave a review' }, { status: 401 })
  }

  let body: CreateReviewBody
  try {
    body = (await request.json()) as CreateReviewBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const response = await fetch(
    apiUrl(`/storefront/reviews?storeId=${encodeURIComponent(STORE_ID)}`),
    {
      method: 'POST',
      headers: sessionHeaders(session.sessionToken),
      body: JSON.stringify({
        productId: body.productId,
        rating: body.rating,
        title: body.title,
        body: body.body,
      }),
      cache: 'no-store',
    },
  )

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message =
      typeof payload.message === 'string'
        ? payload.message
        : Array.isArray(payload.message)
          ? payload.message.join(', ')
          : 'Could not submit review'
    return NextResponse.json({ error: message }, { status: response.status })
  }

  return NextResponse.json(payload, { status: 201 })
}
