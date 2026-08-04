import { NextResponse } from 'next/server'
import { SEO_SITE_URL, xmlEscape } from '@/lib/seo/site-url'
import { getStorefrontCatalog } from '@/lib/catalog/server'
import { productSlug } from '@/lib/catalog/index'

export const revalidate = 3600

const BASE_PUB_DATE = new Date('2026-08-01T00:00:00.000Z').toUTCString()

const POLICY_ITEMS: Array<{ path: string; title: string; description: string }> = [
  {
    path: '/editorial',
    title: 'SPLARO Editorial — Style & Culture',
    description: 'Journal notes on quiet luxury, Bangladesh fashion, and the SPLARO studio.',
  },
  {
    path: '/about',
    title: 'About SPLARO',
    description: 'Quiet luxury fashion for men, women & kids — Dhaka studio + nationwide delivery.',
  },
  {
    path: '/faq',
    title: 'SPLARO FAQ',
    description: 'Shipping, returns, sizing, payments, and COD across Bangladesh.',
  },
  {
    path: '/shipping',
    title: 'Shipping Policy',
    description: 'Nationwide courier delivery across Bangladesh.',
  },
  {
    path: '/returns',
    title: 'Returns Policy',
    description: 'Easy returns guidance for SPLARO orders.',
  },
  {
    path: '/new-arrivals',
    title: 'New Arrivals',
    description: 'Latest SPLARO drops for men, women, and kids.',
  },
  {
    path: '/best-sellers',
    title: 'Best Sellers',
    description: 'Customer favourites from the SPLARO catalog.',
  },
]

function resolvePubDate(item: Record<string, unknown>): string {
  const rawDate = item.updatedAt ?? item.createdAt ?? item.updated_at ?? item.created_at
  if (rawDate) {
    const d = new Date(String(rawDate))
    if (!isNaN(d.getTime())) return d.toUTCString()
  }
  return BASE_PUB_DATE
}

/** Lightweight RSS for AI crawlers + readers — policy & discovery pages. */
export async function GET() {
  const policyItemsXml = POLICY_ITEMS.map(
    (item) => `    <item>
      <title>${xmlEscape(item.title)}</title>
      <link>${xmlEscape(`${SEO_SITE_URL}${item.path}`)}</link>
      <guid isPermaLink="true">${xmlEscape(`${SEO_SITE_URL}${item.path}`)}</guid>
      <description>${xmlEscape(item.description)}</description>
      <pubDate>${BASE_PUB_DATE}</pubDate>
    </item>`,
  )

  const productItemsXml: string[] = []
  let latestDate = new Date('2026-08-01T00:00:00.000Z')

  try {
    const { products } = await getStorefrontCatalog()
    for (const product of products.slice(0, 30)) {
      const slug = product.slug ?? productSlug(product)
      const link = `${SEO_SITE_URL}/products/${slug}`
      const desc = `${product.name} — BDT ${product.price}. Premium fashion from SPLARO Bangladesh.`
      const pubDate = resolvePubDate(product as unknown as Record<string, unknown>)
      
      const itemDate = new Date(pubDate)
      if (!isNaN(itemDate.getTime()) && itemDate > latestDate) {
        latestDate = itemDate
      }

      productItemsXml.push(`    <item>
      <title>${xmlEscape(product.name)}</title>
      <link>${xmlEscape(link)}</link>
      <guid isPermaLink="true">${xmlEscape(link)}</guid>
      <description>${xmlEscape(desc)}</description>
      <pubDate>${pubDate}</pubDate>
    </item>`)
    }
  } catch {
    // Catalog fallback
  }

  const items = [...policyItemsXml, ...productItemsXml].join('\n')
  const lastBuildDate = latestDate.toUTCString()

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>SPLARO</title>
    <link>${xmlEscape(SEO_SITE_URL)}</link>
    <description>SPLARO — luxury fashion Bangladesh. Editorial, policies, and catalog highlights.</description>
    <language>en-bd</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
${items}
  </channel>
</rss>`

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
