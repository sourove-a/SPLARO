import { NextResponse } from 'next/server'
import { getStorefrontCatalog } from '@/lib/catalog/server'
import { productSlug } from '@/lib/catalog/index'
import { SEO_SITE_URL, absoluteUrl, xmlEscape } from '@/lib/seo/site-url'

export const revalidate = 3600
export const dynamic = 'force-dynamic'

/**
 * Image sitemap for Google Image Search + product discovery.
 * https://developers.google.com/search/docs/crawling-indexing/sitemaps/image-sitemaps
 *
 * Only `<image:image>` + `<image:loc>` — title/caption tags are deprecated (2022).
 * External hosts (e.g. Unsplash) are allowed when they are the live product media;
 * placeholders are still excluded.
 */
export async function GET() {
  const base = SEO_SITE_URL
  const urls: string[] = []

  try {
    const { products } = await getStorefrontCatalog()
    for (const product of products) {
      const slug = product.slug ?? productSlug(product)
      const loc = `${base}/products/${slug}`
      const rawImages = [
        product.image,
        product.hoverImage,
        ...(product.media ?? []).filter((m) => m.type === 'image').map((m) => m.url),
        ...(product.variantRefs ?? []).map((ref) => ref.image).filter(Boolean),
      ]

      const images = rawImages
        .filter((src): src is string => Boolean(src))
        .map((src) => absoluteUrl(src))
        .filter((u): u is string => {
          if (!u) return false
          const lower = u.toLowerCase()
          return !lower.includes('placeholder') && !lower.includes('placehold.co')
        })

      const unique = [...new Set(images)].slice(0, 10)
      if (!unique.length) continue

      const imageXml = unique
        .map(
          (img) => `    <image:image>
      <image:loc>${xmlEscape(img)}</image:loc>
    </image:image>`,
        )
        .join('\n')

      urls.push(`  <url>
    <loc>${xmlEscape(loc)}</loc>
${imageXml}
  </url>`)
    }
  } catch {
    // Empty image sitemap is better than 500.
  }

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls.join('\n')}
</urlset>`

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
