import { unstable_cache } from 'next/cache'
import type { StorefrontProduct } from '@/data/storefront'
import type { ProductDetailData, ProductCardData } from '@splaro/types'
import { sanitizeStorefrontProduct } from '@/lib/assets/images'
import { productSlug } from '@/lib/catalog/index'
import { storefrontToCardData } from '@/lib/catalog/product-card-map'
import {
  fetchLiveProductDetailBySlug,
  fetchLiveProductsRaw,
  fetchStorefrontProductListing,
  type ProductReview,
} from './live'
import { LISTING_PAGE_SIZE } from '@/lib/catalog/listing'
import type { CollectionShopContext } from '@/lib/storefront/collection-context'
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

const getCachedLiveCatalog = unstable_cache(
  async (): Promise<CachedCatalog> => {
    // `next build` runs before API starts (CI + Hostinger Git deploy) — skip upstream.
    if (isCiOrProductionBuild()) return BUILD_CATALOG

    const attempts = catalogFetchAttempts()
    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        const live = await fetchLiveProductsRaw()
        if (!live.length) {
          return { products: [], source: 'empty' }
        }
        return { products: live.map(sanitizeStorefrontProduct), source: 'api' }
      } catch {
        if (attempt === attempts - 1) break
      }
    }
    return EMPTY_CATALOG
  },
  ['splaro-storefront-catalog', 'v3-retry'],
  { revalidate: 30, tags: ['storefront-products'] },
)

export async function getStorefrontCatalog(): Promise<CachedCatalog> {
  try {
    const catalog = await getCachedLiveCatalog()
    if (process.env.NODE_ENV === 'development' && catalog.source === 'api-unavailable') {
      console.warn('[splaro] Product catalog API unavailable — showing empty catalog. Run: pnpm dev:stack')
    }
    return catalog
  } catch {
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
        return {
          products: listing.products.map(sanitizeStorefrontProduct),
          source: 'api',
          total: listing.total,
          totalPages: listing.totalPages,
          page: listing.page,
        }
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

  return { products: [], source: 'api-unavailable', total: 0, totalPages: 0, page: 1 }
}

export async function getProductDetailBySlug(
  slug: string,
): Promise<{ product: ProductDetailData; reviews: ProductReview[]; source: CatalogSource } | null> {
  if (isCiOrProductionBuild()) return null

  try {
    const live = await fetchLiveProductDetailBySlug(slug)
    if (live) return { ...live, source: 'api' }
  } catch {
    /* API unavailable — honest not-found / error upstream */
  }

  return null
}

export async function getRelatedProducts(
  product: ProductDetailData,
  limit = 4,
): Promise<ProductCardData[]> {
  try {
    const { products, source } = await getStorefrontCatalog()
    if (source !== 'api' || !products.length) return []

    const others = products.filter((entry) => entry.id !== product.id)
    const sameCategory = others.filter((entry) => entry.category === product.category)
    const picks = sameCategory.length >= 2 ? sameCategory : others
    return picks.slice(0, limit).map((entry) => storefrontToCardData(entry))
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
