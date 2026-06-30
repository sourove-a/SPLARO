import { unstable_cache } from 'next/cache'
import { products as staticProducts } from '@/data/storefront'
import type { StorefrontProduct } from '@/data/storefront'
import type { ProductDetailData } from '@splaro/types'
import { sanitizeStorefrontProduct } from '@/lib/assets/images'
import { getProductBySlug, productSlug, toProductDetail } from '@/lib/catalog/index'
import { fetchLiveProductDetailBySlug, fetchLiveProductsRaw, type ProductReview } from './live'

export type CatalogSource = 'api' | 'static-fallback'

export interface CachedCatalog {
  products: (StorefrontProduct & { slug?: string })[]
  source: CatalogSource
}

const getCachedLiveCatalog = unstable_cache(
  async (): Promise<CachedCatalog> => {
    const live = await fetchLiveProductsRaw()
    return { products: live.map(sanitizeStorefrontProduct), source: 'api' }
  },
  ['splaro-storefront-catalog', 'v2-image-sanitize'],
  // 10s so admin product changes reach the storefront near-instantly (real-time feel).
  { revalidate: 10, tags: ['storefront-products'] },
)

export async function getStorefrontCatalog(): Promise<CachedCatalog> {
  try {
    return await getCachedLiveCatalog()
  } catch {
    return { products: staticProducts.map(sanitizeStorefrontProduct), source: 'static-fallback' }
  }
}

export async function getProductDetailBySlug(
  slug: string,
): Promise<{ product: ProductDetailData; reviews: ProductReview[]; source: CatalogSource } | null> {
  const staticProduct = getProductBySlug(slug)

  const livePromise = fetchLiveProductDetailBySlug(slug).catch(() => null)
  const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000))
  const live = await Promise.race([livePromise, timeoutPromise])

  if (live) return { ...live, source: 'api' }
  if (staticProduct) return { product: staticProduct, reviews: [], source: 'static-fallback' }
  return null
}

export async function getRelatedProducts(
  product: ProductDetailData,
  limit = 4,
): Promise<ProductDetailData[]> {
  try {
    const { products, source } = await getStorefrontCatalog()
    const pool =
      source === 'api' && products.length
        ? products
        : staticProducts.map(sanitizeStorefrontProduct)

    const others = pool.filter((entry) => entry.id !== product.id)
    const sameCategory = others.filter((entry) => entry.category === product.category)
    // Prefer same-category, but never leave "You may also like" empty — fall back to
    // other products so the section always has recommendations.
    const picks = sameCategory.length >= 2 ? sameCategory : others
    return picks.slice(0, limit).map((entry) => toProductDetail(entry))
  } catch {
    return []
  }
}

export async function getAllCatalogSlugs(): Promise<Array<{ slug: string }>> {
  try {
    const { products, source } = await getStorefrontCatalog()
    if (source === 'api' && products.length) {
      return products.map((p) => ({
        slug: ('slug' in p && p.slug ? p.slug : productSlug(p)) as string,
      }))
    }
  } catch {
    /* fall through to static slugs */
  }
  return staticProducts.map((p) => ({ slug: productSlug(p) }))
}
