import { NextResponse } from 'next/server'
import { getStorefrontSettings, type NavLink } from '@/lib/storefront/settings'

export const dynamic = 'force-dynamic'

/**
 * Live header nav for client sync — every route must paint the same mega labels.
 * Avoids stale ISR layout props (old FALLBACK megas) sticking after soft-nav.
 */
export async function GET() {
  try {
    const settings = await getStorefrontSettings()
    const headerNav = (settings.config.headerNav ?? []) as NavLink[]
    return NextResponse.json(
      { headerNav },
      {
        headers: {
          'Cache-Control': 'private, no-store, max-age=0',
        },
      },
    )
  } catch {
    return NextResponse.json({ error: 'Nav unavailable' }, { status: 503 })
  }
}
