import { NextResponse } from 'next/server'
import { getApiBaseUrl } from '@splaro/config'

const STORE_ID = process.env.NEXT_PUBLIC_STORE_ID ?? 'splaro'

export async function GET() {
  try {
    const base = getApiBaseUrl()
    const res = await fetch(
      `${base}/storefront/coupons/active?storeId=${encodeURIComponent(STORE_ID)}`,
      { cache: 'no-store' },
    )
    if (res.ok) {
      return NextResponse.json(await res.json())
    }
    return NextResponse.json(
      { enabled: false, count: 0, codes: [], error: 'Coupon API unavailable' },
      { status: res.status >= 500 ? 503 : res.status },
    )
  } catch {
    return NextResponse.json(
      { enabled: false, count: 0, codes: [], error: 'Coupon service offline' },
      { status: 503 },
    )
  }
}
