import type { MetadataRoute } from 'next'
import { getStorefrontCatalog } from '@/lib/catalog/server'
import { productSlug } from '@/lib/catalog/index'

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

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl.replace(/\/$/, '')
  const now = new Date()

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
    '/size-guide',
    '/shipping',
    '/privacy',
    '/terms',
    '/faq',
    '/payment-policy',
    '/loyalty',
  ].map((path) => ({
    url: `${base}${path}`,
    lastModified: now,
    changeFrequency: path === '' ? 'daily' : 'weekly',
    priority: path === '' ? 1 : 0.7,
  }))

  let productRoutes: MetadataRoute.Sitemap = []
  const categorySet = new Set<string>()

  try {
    const { products } = await getStorefrontCatalog()
    productRoutes = products.map((product) => {
      const slug = product.slug ?? productSlug(product)
      if (product.category) categorySet.add(slugify(String(product.category)))
      return {
        url: `${base}/products/${slug}`,
        lastModified: now,
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      }
    })
  } catch {
    // Catalog/API unavailable — ship static routes so the sitemap never 500s.
  }

  const categoryRoutes: MetadataRoute.Sitemap = [...categorySet].map((category) => ({
    url: `${base}/c/${category}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.6,
  }))

  return [...staticRoutes, ...productRoutes, ...categoryRoutes]
}
