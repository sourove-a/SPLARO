import { NextResponse } from 'next/server'
import { SEO_SITE_URL, xmlEscape } from '@/lib/seo/site-url'

export const revalidate = 3600

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

/** Lightweight RSS for AI crawlers + readers — policy & discovery pages. */
export async function GET() {
  const now = new Date().toUTCString()
  const items = POLICY_ITEMS.map(
    (item) => `    <item>
      <title>${xmlEscape(item.title)}</title>
      <link>${xmlEscape(`${SEO_SITE_URL}${item.path}`)}</link>
      <guid isPermaLink="true">${xmlEscape(`${SEO_SITE_URL}${item.path}`)}</guid>
      <description>${xmlEscape(item.description)}</description>
      <pubDate>${now}</pubDate>
    </item>`,
  ).join('\n')

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>SPLARO</title>
    <link>${xmlEscape(SEO_SITE_URL)}</link>
    <description>SPLARO — luxury fashion Bangladesh. Editorial, policies, and catalog highlights.</description>
    <language>en-bd</language>
    <lastBuildDate>${now}</lastBuildDate>
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
