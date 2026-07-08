import { NextResponse } from 'next/server'
import { getServerApiBaseUrl } from '@splaro/config'

const STORE_ID = process.env.NEXT_PUBLIC_STORE_ID ?? 'splaro'

export async function GET() {
  try {
    const base = getServerApiBaseUrl()
    const res = await fetch(
      `${base}/storefront/promos/availability?storeId=${encodeURIComponent(STORE_ID)}`,
      { cache: 'no-store' },
    )
    if (res.ok) {
      return NextResponse.json(await res.json())
    }
    return NextResponse.json({ hasActivePromo: false }, { status: 200 })
  } catch {
    return NextResponse.json({ hasActivePromo: false }, { status: 200 })
  }
}
