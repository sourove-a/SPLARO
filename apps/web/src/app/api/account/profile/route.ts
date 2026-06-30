import { NextResponse } from 'next/server'
import { apiAuthMe, getSessionToken } from '@/lib/server/api-auth'
import { fetchCustomerProfile } from '@/lib/catalog/live'

export async function GET() {
  // Validate against the backend session (same as /api/auth/me), not the legacy
  // file-based store — otherwise a logged-in customer always gets 401 here.
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
      loyaltyTier: customer?.loyaltyTier ?? 'BRONZE',
      totalOrders: customer?.totalOrders ?? 0,
    },
  })
}
