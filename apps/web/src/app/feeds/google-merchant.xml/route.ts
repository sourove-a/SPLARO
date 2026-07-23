import { NextResponse } from 'next/server'
import { getStorefrontCatalog } from '@/lib/catalog/server'
import { productSlug, isStorefrontProductInStock } from '@/lib/catalog/index'
import { SEO_SITE_URL, absoluteUrl, stripHtml, xmlEscape } from '@/lib/seo/site-url'

export const revalidate = 3600
export const dynamic = 'force-dynamic'

/**
 * Google Merchant Center product feed (XML).
 * Admin “View feed” → https://splaro.co/feeds/google-merchant.xml
 */
export async function GET() {
  const base = SEO_SITE_URL
  const items: string[] = []

  try {
    const { products } = await getStorefrontCatalog()
    for (const product of products) {
      const slug = product.slug ?? productSlug(product)
      const link = `${base}/products/${slug}`
      const imageLink = absoluteUrl(product.image)
      if (!imageLink || imageLink.includes('placeholder')) continue

      const price = Number(product.price)
      if (!Number.isFinite(price) || price <= 0) continue

      const description = stripHtml(
        `${product.name}. Premium fashion from SPLARO Bangladesh. ${product.material || ''} ${product.fit || ''}`.trim(),
      ).slice(0, 5000)

      const availability = isStorefrontProductInStock(product) ? 'in_stock' : 'out_of_stock'
      const id = (product.code || product.id).replace(/[^\w.-]/g, '_').slice(0, 50)
      const additional = (product.media ?? [])
        .filter((m) => m.type === 'image')
        .map((m) => absoluteUrl(m.url))
        .filter((u) => u && u !== imageLink)
        .slice(0, 9)

      const compareAt = product.compareAtPrice != null ? Number(product.compareAtPrice) : null
      const onSale = compareAt != null && compareAt > price
      const priceXml = onSale
        ? `      <g:price>${compareAt.toFixed(2)} BDT</g:price>
      <g:sale_price>${price.toFixed(2)} BDT</g:sale_price>`
        : `      <g:price>${price.toFixed(2)} BDT</g:price>`

      items.push(`    <item>
      <g:id>${xmlEscape(id)}</g:id>
      <g:title>${xmlEscape(product.name.slice(0, 150))}</g:title>
      <g:description>${xmlEscape(description)}</g:description>
      <g:link>${xmlEscape(link)}</g:link>
      <g:image_link>${xmlEscape(imageLink)}</g:image_link>
${additional.map((u) => `      <g:additional_image_link>${xmlEscape(u)}</g:additional_image_link>`).join('\n')}
      <g:availability>${availability}</g:availability>
${priceXml}
      <g:brand>SPLARO</g:brand>
      <g:condition>new</g:condition>
      <g:product_type>${xmlEscape(String(product.categoryName ?? product.category))}</g:product_type>
      <g:google_product_category>Apparel &amp; Accessories</g:google_product_category>
      <g:identifier_exists>false</g:identifier_exists>
      <g:shipping>
        <g:country>BD</g:country>
        <g:service>Standard</g:service>
        <g:price>0.00 BDT</g:price>
      </g:shipping>
    </item>`)
    }
  } catch {
    // Empty feed better than 500 for Merchant Center fetch.
  }

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>SPLARO Product Feed</title>
    <link>${xmlEscape(base)}</link>
    <description>SPLARO — luxury fashion Bangladesh (BDT). Google Merchant Center feed.</description>
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
