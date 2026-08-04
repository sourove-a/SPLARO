import { NextResponse } from 'next/server'
import { getStorefrontSettings } from '@/lib/storefront/settings'

export const dynamic = 'force-dynamic'

/**
 * Live storefront shell settings for client sync.
 * Avoids stale ISR root-layout props leaving header/footer out of sync after soft-nav.
 */
export async function GET() {
  try {
    const settings = await getStorefrontSettings()
    return NextResponse.json(
      { settings },
      {
        headers: {
          'Cache-Control': 'private, no-store, max-age=0',
        },
      },
    )
  } catch {
    return NextResponse.json({ error: 'Storefront settings unavailable' }, { status: 503 })
  }
}
