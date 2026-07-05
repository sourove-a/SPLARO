import type { HeroBanner } from '@/lib/api/banners'
import { productSlug } from '@/lib/catalog/index'
import type { StorefrontProduct } from '@/data/storefront'

/** Build hero slides from live catalog when no Banner rows exist in admin. */
export function heroBannersFromCatalog(
  products: (StorefrontProduct & { slug?: string })[],
): HeroBanner[] {
  if (!products.length) return []

  const picks = [
    products.find((p) => p.isBestSeller),
    products.find((p) => p.isNewArrival),
    products[0],
  ].filter(Boolean) as (StorefrontProduct & { slug?: string })[]

  const seen = new Set<string>()
  const unique = picks.filter((p) => {
    if (seen.has(p.id)) return false
    seen.add(p.id)
    return Boolean(p.image?.trim())
  })

  return unique.slice(0, 3).map((product, index) => ({
    id: `catalog-${product.id}`,
    title: product.name,
    subtitle: product.category ? `${product.category} collection` : 'Shop SPLARO',
    image: product.image,
    linkUrl: `/products/${product.slug ?? productSlug(product)}`,
    sortOrder: index,
  }))
}

export function resolveHeroBanners(
  apiBanners: HeroBanner[],
  products: (StorefrontProduct & { slug?: string })[],
): HeroBanner[] {
  const fromApi = apiBanners.filter((banner) => banner.image?.trim())
  if (fromApi.length) return fromApi
  return heroBannersFromCatalog(products)
}
