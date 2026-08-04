import { NextResponse } from 'next/server'
import { getStorefrontCatalog } from '@/lib/catalog/server'
import { SEO_SITE_URL, xmlEscape } from '@/lib/seo/site-url'
import { buildMerchantFeedItems } from '@/lib/seo/merchant-feed-items'
import { getCheckoutShippingSettings } from '@/lib/storefront/settings'

export const revalidate = 3600
export const dynamic = 'force-dynamic'

/**
 * Google Merchant Center product feed (XML).
 * Admin “View feed” → https://splaro.co/feeds/google-merchant.xml
 */
export async function GET() {
  const base = SEO_SITE_URL
  let items: string[] = []

  try {
    const [{ products }, shipping] = await Promise.all([
      getStorefrontCatalog(),
      getCheckoutShippingSettings(),
    ])
    items = buildMerchantFeedItems(products, base, shipping.outsideDhakaCharge)
  } catch {
    // Empty feed better than 500 for Merchant Center fetch.
  }

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>SPLARO Product Feed</title>
    <link>${xmlEscape(base)}</link>
    <description>SPLARO — premium fashion for men, women and kids in Bangladesh (BDT). Google Merchant Center feed.</description>
${items.join('\n')}
  </channel>
</rss>`

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
