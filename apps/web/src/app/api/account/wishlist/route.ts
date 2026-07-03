import { NextResponse } from 'next/server'
import { getApiBaseUrl } from '@splaro/config'
import { apiAuthMe, getSessionToken, sessionHeaders } from '@/lib/server/api-auth'

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

export async function GET() {
  const session = await requireSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const response = await fetch(
    apiUrl(`/storefront/customer/wishlist?storeId=${encodeURIComponent(STORE_ID)}`),
    { headers: sessionHeaders(session.sessionToken), cache: 'no-store' },
  )
  if (!response.ok) {
    return NextResponse.json({ error: 'Could not load wishlist' }, { status: response.status })
  }
  return NextResponse.json(await response.json())
}

export async function PUT(request: Request) {
  const session = await requireSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json()) as { productIds?: string[] }
  const response = await fetch(
    apiUrl(`/storefront/customer/wishlist/merge?storeId=${encodeURIComponent(STORE_ID)}`),
    {
      method: 'POST',
      headers: sessionHeaders(session.sessionToken),
      body: JSON.stringify({ productIds: body.productIds ?? [] }),
      cache: 'no-store',
    },
  )
  if (!response.ok) {
    return NextResponse.json({ error: 'Could not sync wishlist' }, { status: response.status })
  }
  return NextResponse.json(await response.json())
}

export async function POST(request: Request) {
  const session = await requireSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json()) as { productId?: string }
  const response = await fetch(
    apiUrl(`/storefront/customer/wishlist/toggle?storeId=${encodeURIComponent(STORE_ID)}`),
    {
      method: 'POST',
      headers: sessionHeaders(session.sessionToken),
      body: JSON.stringify({ productId: body.productId ?? '' }),
      cache: 'no-store',
    },
  )
  if (!response.ok) {
    return NextResponse.json({ error: 'Could not update wishlist' }, { status: response.status })
  }
  return NextResponse.json(await response.json())
}
