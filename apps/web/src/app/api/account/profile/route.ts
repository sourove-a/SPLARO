import { NextResponse } from 'next/server'
import { getServerApiBaseUrl } from '@splaro/config'
import { apiAuthMe, getSessionToken, sessionHeaders } from '@/lib/server/api-auth'
import { fetchCustomerProfile } from '@/lib/catalog/live'

function apiUrl(path: string): string {
  const base = getServerApiBaseUrl()
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

export async function GET() {
  const sessionToken = await getSessionToken()
  if (!sessionToken) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }

  const user = await apiAuthMe(sessionToken)
  if (!user) {
    return NextResponse.json({ error: 'Session expired' }, { status: 401 })
  }

  const customer = user.phone ? await fetchCustomerProfile(user.phone) : null

  return NextResponse.json({
    profile: {
      memberSince: customer?.createdAt ?? null,
      loyaltyPoints: customer?.loyaltyPoints ?? 0,
      loyaltyTier: customer?.loyaltyTier ?? user.loyaltyTier ?? 'BRONZE',
      totalOrders: customer?.totalOrders ?? 0,
    },
    user,
  })
}

export async function PATCH(request: Request) {
  const sessionToken = await getSessionToken()
  if (!sessionToken) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }

  const body = (await request.json()) as { name?: string; avatar?: string | null }
  const response = await fetch(apiUrl('/storefront/auth/profile'), {
    method: 'PATCH',
    headers: sessionHeaders(sessionToken),
    body: JSON.stringify(body),
    cache: 'no-store',
  })

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { message?: string }
    return NextResponse.json(
      { error: payload.message ?? 'Could not update profile' },
      { status: response.status },
    )
  }

  const payload = (await response.json()) as { user?: Record<string, unknown> }
  return NextResponse.json(payload)
}
