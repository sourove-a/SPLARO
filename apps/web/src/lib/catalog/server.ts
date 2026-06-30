import { unstable_cache } from 'next/cache'
import { products as staticProducts } from '@/data/storefront'
import type { StorefrontProduct } from '@/data/storefront'
import type { ProductDetailData, ProductCardData } from '@splaro/types'
import { sanitizeStorefrontProduct } from '@/lib/assets/images'
import { getProductBySlug, productSlug, toProductCard } from '@/lib/catalog/index'
import {
  fetchLiveProductDetailBySlug,
  fetchLiveProductsRaw,
  fetchStorefrontProductListing,
  type ProductReview,
} from './live'
import { LISTING_PAGE_SIZE } from '@/lib/catalog/listing'
import type { CollectionShopContext } from '@/lib/storefront/collection-context'

export type CatalogSource = 'api' | 'static-fallback'

export interface CachedCatalog {
  products: (StorefrontProduct & { slug?: string })[]
  source: CatalogSource
  total?: number
  totalPages?: number
  page?: number
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

/** Scoped listing for collection / category PLP routes (server-rendered first page). */
export async function getStorefrontCatalogForCollection(
  context: CollectionShopContext,
): Promise<CachedCatalog> {
  const attempts: Array<{
    collectionSlug?: string
    categorySlug?: string
    parentCategorySlug?: string
  }> = [
    { collectionSlug: context.collectionSlug },
    ...(context.categorySlug ? [{ categorySlug: context.categorySlug }] : []),
    { parentCategorySlug: context.slug },
  ]

  for (const query of attempts) {
    const listing = await fetchStorefrontProductListing({
      ...query,
      page: 1,
      limit: LISTING_PAGE_SIZE,
    })
    if (listing.products.length > 0) {
      return {
        products: listing.products.map(sanitizeStorefrontProduct),
        source: 'api',
        total: listing.total,
        totalPages: listing.totalPages,
        page: listing.page,
      }
    }
  }

  try {
    const full = await getStorefrontCatalog()
    if (full.source === 'api' && full.products.length) {
      const filtered =
        context.initialCategory === 'All'
          ? full.products
          : full.products.filter((product) => product.category === context.initialCategory)
      if (filtered.length) {
        return {
          products: filtered,
          source: 'api',
          total: filtered.length,
          totalPages: 1,
          page: 1,
        }
      }
    }
  } catch {
    /* fall through */
  }

  const staticFiltered =
    context.initialCategory === 'All'
      ? staticProducts
      : staticProducts.filter((product) => product.category === context.initialCategory)

  return {
    products: staticFiltered.map(sanitizeStorefrontProduct),
    source: 'static-fallback',
    total: staticFiltered.length,
    totalPages: 1,
    page: 1,
  }
}

export async function getProductDetailBySlug(
  slug: string,
): Promise<{ product: ProductDetailData; reviews: ProductReview[]; source: CatalogSource } | null> {
  const staticProduct = getProductBySlug(slug)

  try {
    const live = await fetchLiveProductDetailBySlug(slug)
    if (live) return { ...live, source: 'api' }
  } catch {
    /* API unavailable — fall back to static catalog */
  }

  if (staticProduct) {
    return { product: staticProduct, reviews: [], source: 'static-fallback' }
  }

  return null
}

export async function getRelatedProducts(
  product: ProductDetailData,
  limit = 4,
): Promise<ProductCardData[]> {
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
    return picks.slice(0, limit).map((entry) => toProductCard(entry))
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
