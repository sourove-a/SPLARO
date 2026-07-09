import { NextResponse } from 'next/server'
import { getServerApiBaseUrl } from '@splaro/config'
import { apiAuthMe, getSessionToken, sessionHeaders } from '@/lib/server/api-auth'
import { fetchCustomerProfile } from '@/lib/catalog/live'

const STORE_ID = process.env.NEXT_PUBLIC_STORE_ID ?? 'splaro'

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

  let address: { address: string; district: string; thana: string } | null = null
  try {
    const addressRes = await fetch(
      `${apiUrl('/storefront/customer/address')}?storeId=${encodeURIComponent(STORE_ID)}`,
      { headers: sessionHeaders(sessionToken), cache: 'no-store' },
    )
    if (addressRes.ok) {
      const payload = (await addressRes.json()) as {
        address?: { address: string; district: string; thana: string } | null
      }
      address = payload.address ?? null
    }
  } catch {
    /* address optional — profile still loads */
  }

  return NextResponse.json({
    profile: {
      memberSince: customer?.createdAt ?? null,
      loyaltyPoints: customer?.loyaltyPoints ?? 0,
      loyaltyTier: customer?.loyaltyTier ?? user.loyaltyTier ?? 'BRONZE',
      totalOrders: customer?.totalOrders ?? 0,
    },
    address,
    user,
  })
}

export async function PATCH(request: Request) {
  const sessionToken = await getSessionToken()
  if (!sessionToken) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }

  const body = (await request.json()) as {
    name?: string
    avatar?: string | null
    address?: string
    district?: string
    thana?: string
  }

  let user: Record<string, unknown> | undefined

  if (body.name !== undefined || body.avatar !== undefined) {
    const response = await fetch(apiUrl('/storefront/auth/profile'), {
      method: 'PATCH',
      headers: sessionHeaders(sessionToken),
      body: JSON.stringify({
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.avatar !== undefined ? { avatar: body.avatar } : {}),
      }),
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
    user = payload.user
  }

  let address: { address: string; district: string; thana: string } | undefined

  if (
    body.address !== undefined ||
    body.district !== undefined ||
    body.thana !== undefined
  ) {
    const response = await fetch(
      `${apiUrl('/storefront/customer/address')}?storeId=${encodeURIComponent(STORE_ID)}`,
      {
        method: 'PATCH',
        headers: sessionHeaders(sessionToken),
        body: JSON.stringify({
          address: body.address ?? '',
          district: body.district ?? '',
          thana: body.thana ?? '',
        }),
        cache: 'no-store',
      },
    )

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { message?: string }
      return NextResponse.json(
        { error: payload.message ?? 'Could not save delivery address' },
        { status: response.status },
      )
    }

    const payload = (await response.json()) as {
      address?: { address: string; district: string; thana: string }
    }
    address = payload.address
  }

  if (!user) {
    const current = await apiAuthMe(sessionToken)
    if (!current) {
      return NextResponse.json({ error: 'Session expired' }, { status: 401 })
    }
    user = current as unknown as Record<string, unknown>
  }

  return NextResponse.json({ user, ...(address ? { address } : {}) })
}
