import type { MetadataRoute } from 'next'
import { isFeatureEnabled } from '@splaro/config'
import { getStorefrontCatalog } from '@/lib/catalog/server'
import { productSlug } from '@/lib/catalog/index'
import { collectionHref } from '@/lib/storefront/collection-paths'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://splaro.co'

// Re-generate hourly so newly published products surface to search + AI engines fast.
export const revalidate = 3600

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function resolveProductLastMod(product: Record<string, unknown>): Date {
  const rawDate = product.updatedAt ?? product.createdAt ?? product.updated_at ?? product.created_at
  if (rawDate) {
    const d = new Date(String(rawDate))
    if (!isNaN(d.getTime())) return d
  }
  return new Date()
}

/** Canonical storefront path for a category slug — never /collections/* (307 → /c/*). */
function categoryCanonicalPath(category: string): string {
  if (category === 'accessories') return '/accessories'
  if (category === 'footwear') return '/footwear'
  return collectionHref(category)
}

function dedupeByUrl(entries: MetadataRoute.Sitemap): MetadataRoute.Sitemap {
  const seen = new Set<string>()
  const out: MetadataRoute.Sitemap = []
  for (const entry of entries) {
    if (seen.has(entry.url)) continue
    seen.add(entry.url)
    out.push(entry)
  }
  return out
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl.replace(/\/$/, '')

  // Omit lastmod on static pages — Google ignores inaccurate fixed dates.
  const staticRoutes: MetadataRoute.Sitemap = [
    '',
    '/shop',
    '/collections',
    '/new-arrivals',
    '/best-sellers',
    '/accessories',
    '/footwear',
    '/about',
    '/contact',
    '/stores',
    '/size-guide',
    '/shipping',
    '/returns',
    '/privacy',
    '/terms',
    '/faq',
    '/payment-policy',
    '/gift-card-policy',
    '/editorial',
    ...(isFeatureEnabled('loyalty') ? ['/loyalty'] : []),
  ].map((path) => ({
    url: `${base}${path}`,
    changeFrequency: path === '' || path === '/shop' ? ('daily' as const) : ('weekly' as const),
    priority:
      path === ''
        ? 1
        : path === '/shop'
          ? 0.9
          : path === '/faq'
            ? 0.75
            : 0.7,
  }))

  let productRoutes: MetadataRoute.Sitemap = []
  const categorySet = new Set<string>()
  const categoryLastModMap = new Map<string, Date>()

  try {
    const { products } = await getStorefrontCatalog()
    productRoutes = products.map((product) => {
      const slug = product.slug ?? productSlug(product)
      const lastMod = resolveProductLastMod(product as unknown as Record<string, unknown>)

      if (product.category) {
        const catKey = slugify(String(product.category))
        categorySet.add(catKey)
        const currentMax = categoryLastModMap.get(catKey)
        if (!currentMax || lastMod > currentMax) {
          categoryLastModMap.set(catKey, lastMod)
        }
      }

      return {
        url: `${base}/products/${slug}`,
        lastModified: lastMod,
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      }
    })
  } catch {
    // Catalog/API unavailable — ship static routes so the sitemap never 500s.
  }

  const categoryRoutes: MetadataRoute.Sitemap = [...categorySet].map((category) => {
    const routePath = categoryCanonicalPath(category)
    return {
      url: `${base}${routePath}`,
      lastModified: categoryLastModMap.get(category) ?? new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    }
  })

  return dedupeByUrl([...staticRoutes, ...productRoutes, ...categoryRoutes])
}
