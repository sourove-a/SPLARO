import { unstable_cache } from 'next/cache'
import { cache } from 'react'
import type { StorefrontProduct } from '@/data/storefront'
import type { ProductDetailData, ProductCardData } from '@splaro/types'
import { sanitizeStorefrontProduct } from '@/lib/assets/images'
import { productSlug, toProductDetail } from '@/lib/catalog/index'
import { storefrontToCardData } from '@/lib/catalog/product-card-map'
import {
  fetchLiveProductDetailBySlug,
  fetchLiveProductsRaw,
  fetchStorefrontProductListing,
  type ProductReview,
} from './live'
import { LISTING_PAGE_SIZE } from '@/lib/catalog/listing'
import type { CollectionShopContext } from '@/lib/storefront/collection-context'
import { rememberGoodCatalog, resolveCatalogFailure, getStaleCatalog } from '@/lib/catalog/catalog-stale'
import { catalogFetchAttempts } from '@/lib/server/fetch-timeouts'
import { isCiOrProductionBuild } from '@/lib/server/build-safe-fetch'

export type CatalogSource = 'api' | 'api-unavailable' | 'empty'

export interface CachedCatalog {
  products: (StorefrontProduct & { slug?: string })[]
  source: CatalogSource
  total?: number
  totalPages?: number
  page?: number
}

const BUILD_CATALOG: CachedCatalog = { products: [], source: 'empty' }
const EMPTY_CATALOG: CachedCatalog = { products: [], source: 'api-unavailable' }

async function fetchLiveCatalogDirect(): Promise<CachedCatalog> {
  if (isCiOrProductionBuild()) return BUILD_CATALOG

  const attempts = catalogFetchAttempts()
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const live = await fetchLiveProductsRaw()
      if (!live.length) {
        return { products: [], source: 'empty' }
      }
      const catalog: CachedCatalog = {
        products: live.map(sanitizeStorefrontProduct),
        source: 'api',
      }
      rememberGoodCatalog(catalog)
      return catalog
    } catch {
      if (attempt === attempts - 1) break
      await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)))
    }
  }
  const stale = getStaleCatalog()
  if (stale) return stale
  throw new Error('storefront-catalog-unavailable')
}

const getCachedLiveCatalog = unstable_cache(
  async (): Promise<CachedCatalog> => fetchLiveCatalogDirect(),
  ['splaro-storefront-catalog', 'v4-no-failure-cache'],
  { revalidate: 30, tags: ['storefront-products'] },
)

export async function getStorefrontCatalog(): Promise<CachedCatalog> {
  try {
    const catalog =
      process.env.NODE_ENV === 'development'
        ? await fetchLiveCatalogDirect()
        : await getCachedLiveCatalog()
    if (catalog.source === 'api' && catalog.products.length) {
      rememberGoodCatalog(catalog)
    }
    return catalog
  } catch {
    const fallback = resolveCatalogFailure(EMPTY_CATALOG)
    if (fallback.products.length) return fallback
    if (process.env.NODE_ENV === 'development') {
      console.warn('[splaro] Product catalog API unavailable — showing empty catalog. Run: pnpm dev:stack')
    }
    return EMPTY_CATALOG
  }
}

/** Scoped listing for collection / category PLP routes (server-rendered first page). */
export async function getStorefrontCatalogForCollection(
  context: CollectionShopContext,
): Promise<CachedCatalog> {
  if (isCiOrProductionBuild()) {
    return { products: [], source: 'empty', total: 0, totalPages: 0, page: 1 }
  }

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
    try {
      const listing = await fetchStorefrontProductListing({
        ...query,
        page: 1,
        limit: LISTING_PAGE_SIZE,
      })
      if (listing.products.length > 0) {
        const catalog: CachedCatalog = {
          products: listing.products.map(sanitizeStorefrontProduct),
          source: 'api',
          total: listing.total,
          totalPages: listing.totalPages,
          page: listing.page,
        }
        rememberGoodCatalog(catalog)
        return catalog
      }
    } catch {
      /* try next query */
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
    /* unavailable */
  }

  const stale = getStaleCatalog()
  if (stale?.products.length) {
    const filtered =
      context.initialCategory === 'All'
        ? stale.products
        : stale.products.filter((product) => product.category === context.initialCategory)
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

  return { products: [], source: 'api-unavailable', total: 0, totalPages: 0, page: 1 }
}

/** Per-slug detail cache — product clicks stop paying a live API round trip on
    every view. Real 404s (live == null) are cached; transient API errors throw,
    so they are NOT cached and the next request retries. */
const getCachedProductDetail = unstable_cache(
  async (
    slug: string,
  ): Promise<{ product: ProductDetailData; reviews: ProductReview[]; source: CatalogSource } | null> => {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const live = await fetchLiveProductDetailBySlug(slug)
        return live ? { ...live, source: 'api' } : null
      } catch (error) {
        if (attempt === 1) throw error
      }
    }
    return null
  },
  ['splaro-product-detail', 'v1'],
  { revalidate: 30, tags: ['storefront-products'] },
)

export const getProductDetailBySlug = cache(async function getProductDetailBySlug(
  slug: string,
): Promise<{ product: ProductDetailData; reviews: ProductReview[]; source: CatalogSource } | null> {
  if (isCiOrProductionBuild()) return null

  try {
    return await getCachedProductDetail(slug)
  } catch {
    /* API unavailable — fall back to last good catalog entry */
  }

  const stale = getStaleCatalog()
  if (stale?.products.length) {
    const match = stale.products.find(
      (entry) => entry.slug === slug || productSlug(entry) === slug,
    )
    if (match) {
      return { product: toProductDetail(match), reviews: [], source: 'api' }
    }
  }

  return null
})

export async function getRelatedProducts(
  product: ProductDetailData,
  limit = 4,
): Promise<ProductCardData[]> {
  try {
    const listing = await fetchStorefrontProductListing({
      ...(product.categorySlug ? { categorySlug: product.categorySlug } : {}),
      page: 1,
      limit: limit + 2,
    })
    if (!listing.products.length) return []

    return listing.products
      .filter((entry) => entry.id !== product.id)
      .slice(0, limit)
      .map((entry) => storefrontToCardData(entry))
  } catch {
    return []
  }
}

export async function getAllCatalogSlugs(): Promise<Array<{ slug: string }>> {
  try {
    const { products, source } = await getStorefrontCatalog()
    if (products.length) {
      return products.map((p) => ({
        slug: ('slug' in p && p.slug ? p.slug : productSlug(p)) as string,
      }))
    }
    if (source === 'empty' || source === 'api-unavailable') return []
  } catch {
    /* unavailable */
  }
  return []
}

/** Live footwear row products for /footwear landing page. */
export async function fetchFootwearRowProducts(
  parentCategorySlug: string,
  limit = 12,
): Promise<(StorefrontProduct & { slug: string })[]> {
  try {
    const listing = await fetchStorefrontProductListing({
      parentCategorySlug,
      page: 1,
      limit,
    })
    return listing.products.map(sanitizeStorefrontProduct) as (StorefrontProduct & { slug: string })[]
  } catch {
    return []
  }
}
