import { NextResponse } from 'next/server'
import { getApiBaseUrl } from '@splaro/config'
import { apiAuthMe, getSessionToken, sessionHeaders } from '@/lib/server/api-auth'
import { fetchCustomerProfile } from '@/lib/catalog/live'

function apiUrl(path: string): string {
  const base = getApiBaseUrl()
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

export async function GET() {
  const sessionToken = await getSessionToken()
  const user = sessionToken ? await apiAuthMe(sessionToken) : null
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
