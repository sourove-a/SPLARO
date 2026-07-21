import { unstable_cache } from 'next/cache'
import { cache } from 'react'
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
import { rememberGoodCatalog, resolveCatalogFailure, getStaleCatalog } from '@/lib/catalog/catalog-stale'
import { catalogFetchAttempts } from '@/lib/server/fetch-timeouts'
import { isCiOrProductionBuild } from '@/lib/server/build-safe-fetch'
import { colorGroup } from '@/data/storefront'
import type { ProductVariantData } from '@splaro/types'

/** Stale listing → PDP detail with real variantRefs (never empty generateVariants). */
function toProductDetailFromStale(
  product: StorefrontProduct & { slug?: string },
): ProductDetailData {
  const card = storefrontToCardData(product)
  const variants: ProductVariantData[] = (product.variantRefs ?? [])
    .filter((ref) => ref.isActive)
    .map((ref) => {
      const row: ProductVariantData = {
        id: ref.id,
        price: product.price,
        stock: ref.stock,
        isActive: ref.isActive,
        image: product.image,
      }
      if (ref.size) row.size = ref.size
      if (ref.colorHex) {
        const hex = ref.colorHex.toLowerCase()
        row.colorHex = hex
        row.color = colorGroup(hex)
        row.colorName = colorGroup(hex)
      }
      if (product.compareAtPrice) row.compareAtPrice = product.compareAtPrice
      return row
    })

  return {
    ...card,
    description: `${product.name} — premium piece from SPLARO.`,
    shortDescription: `${product.fit} fit · ${product.material}`,
    sku: product.code,
    fabricContent: product.material,
    variants,
    tags: [product.category, product.status, product.fit].filter(Boolean) as string[],
    metaTitle: product.name,
    metaDescription: `Shop ${product.name} at SPLARO.`,
  }
}

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

export const HOMEPAGE_CATALOG_LIMIT = 8

/** Prefer women's RTW on the homepage — mixed men/kids/footwear dilutes brand. */
function isWomenFocusedProduct(product: {
  category?: string | null
  categorySlug?: string | null
  categoryName?: string | null
  tags?: string[] | null
}): boolean {
  const cat = (product.category ?? product.categoryName ?? '').toLowerCase()
  const slug = (product.categorySlug ?? '').toLowerCase()
  const tags = (product.tags ?? []).map((t) => t.toLowerCase())
  if (cat === 'men' || cat === 'kids' || cat === 'footwear') return false
  if (slug.includes('men') && !slug.includes('women')) return false
  if (slug.includes('kid') || slug.includes('boy') || slug.includes('baby')) return false
  if (slug.includes('footwear') || slug.includes('shoe')) return false
  if (
    cat === 'women' ||
    cat === 'summer edition' ||
    slug.includes('women') ||
    slug.includes('dress') ||
    slug.includes('saree') ||
    slug.includes('kurti') ||
    tags.includes('women')
  ) {
    return true
  }
  return cat === 'accessories' ? false : cat.length === 0
}

function preferWomenProducts<T extends Parameters<typeof isWomenFocusedProduct>[0]>(
  products: T[],
  limit: number,
): T[] {
  const women = products.filter(isWomenFocusedProduct)
  if (women.length >= limit) return women.slice(0, limit)
  const soft = products.filter((p) => {
    const cat = (p.category ?? p.categoryName ?? '').toLowerCase()
    return cat !== 'men' && cat !== 'kids'
  })
  const seen = new Set(women.map((p) => (p as { id?: string }).id))
  const merged = [...women]
  for (const p of soft) {
    if (merged.length >= limit) break
    const id = (p as { id?: string }).id
    if (id && seen.has(id)) continue
    if (id) seen.add(id)
    merged.push(p)
  }
  if (merged.length >= Math.min(4, limit)) return merged.slice(0, limit)
  return products.slice(0, limit)
}

async function fetchHomeCatalogPreviewDirect(limit = HOMEPAGE_CATALOG_LIMIT): Promise<CachedCatalog> {
  if (isCiOrProductionBuild()) return BUILD_CATALOG

  try {
    const womenFirst = await fetchStorefrontProductListing({
      page: 1,
      limit,
      categorySlug: 'women',
    })
    const womenParent =
      womenFirst.products.length >= Math.min(4, limit)
        ? womenFirst
        : await fetchStorefrontProductListing({
            page: 1,
            limit,
            parentCategorySlug: 'women',
          })

    const pool =
      womenParent.products.length >= Math.min(4, limit)
        ? womenParent
        : await fetchStorefrontProductListing({ page: 1, limit: Math.max(limit * 4, 32) })

    const curated = preferWomenProducts(pool.products, limit)
    if (!curated.length) {
      return { products: [], source: 'empty' }
    }
    const catalog: CachedCatalog = {
      products: curated.map(sanitizeStorefrontProduct),
      source: 'api',
      total: curated.length,
      totalPages: 1,
      page: 1,
    }
    rememberGoodCatalog(catalog)
    return catalog
  } catch {
    const full = await fetchLiveCatalogDirect()
    return {
      ...full,
      products: preferWomenProducts(full.products, limit),
    }
  }
}

const getCachedHomeCatalogPreview = unstable_cache(
  async (): Promise<CachedCatalog> => fetchHomeCatalogPreviewDirect(),
  ['splaro-home-catalog-preview', 'v2-women'],
  { revalidate: 30, tags: ['storefront-products'] },
)

/** Homepage only — 8 products, not the full catalog dump. */
export async function getStorefrontCatalogPreview(
  limit = HOMEPAGE_CATALOG_LIMIT,
): Promise<CachedCatalog> {
  try {
    const catalog =
      process.env.NODE_ENV === 'development'
        ? await fetchHomeCatalogPreviewDirect(limit)
        : await getCachedHomeCatalogPreview()
    if (catalog.source === 'api' && catalog.products.length) {
      rememberGoodCatalog(catalog)
    }
    return catalog
  } catch {
    const fallback = resolveCatalogFailure(EMPTY_CATALOG)
    if (fallback.products.length) {
      return { ...fallback, products: fallback.products.slice(0, limit) }
    }
    return EMPTY_CATALOG
  }
}

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

/** Paginated shop listing — first page only. Does not poison the full-catalog stale cache. */
export async function getStorefrontCatalogPage(
  page = 1,
  limit = LISTING_PAGE_SIZE,
): Promise<CachedCatalog> {
  if (isCiOrProductionBuild()) {
    return { products: [], source: 'empty', total: 0, totalPages: 0, page: 1 }
  }

  try {
    const listing = await fetchStorefrontProductListing({ page, limit })
    return {
      products: listing.products.map(sanitizeStorefrontProduct),
      source: listing.products.length ? 'api' : 'empty',
      total: listing.total,
      totalPages: listing.totalPages,
      page: listing.page,
    }
  } catch {
    return { ...EMPTY_CATALOG, total: 0, totalPages: 0, page: 1 }
  }
}

/** Scoped listing for collection / category PLP routes (server-rendered first page). */
export async function getStorefrontCatalogForCollection(
  context: CollectionShopContext,
): Promise<CachedCatalog> {
  if (isCiOrProductionBuild()) {
    return { products: [], source: 'empty', total: 0, totalPages: 0, page: 1 }
  }

  // Parent-tree first (matches homepage dept rails). Never prefer slug-prefix
  // categorySlug — that historically pulled men-footwear into /c/men.
  const attempts: Array<{
    collectionSlug?: string
    categorySlug?: string
    parentCategorySlug?: string
  }> = [
    { parentCategorySlug: context.parentCategorySlug || context.slug },
    ...(context.categorySlug && context.categorySlug !== context.slug
      ? [{ categorySlug: context.categorySlug }]
      : []),
    { collectionSlug: context.collectionSlug },
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

  // Scoped PLP only — never dump the full shop catalog into /c/:slug
  // (unknown/stale mega links used to fall through to All = Men+Women mix).
  if (context.initialCategory !== 'All') {
    try {
      const full = await getStorefrontCatalog()
      if (full.source === 'api' && full.products.length) {
        const filtered = full.products.filter(
          (product) => product.category === context.initialCategory,
        )
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
      const filtered = stale.products.filter(
        (product) => product.category === context.initialCategory,
      )
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
  }

  return { products: [], source: 'api', total: 0, totalPages: 0, page: 1 }
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
  } catch (error) {
    /* Prefer a usable stale catalog entry over a blank error page, but never
       invent empty-variant details (that looks like always OOS). */
    const stale = getStaleCatalog()
    if (stale?.products.length) {
      const match = stale.products.find(
        (entry) => entry.slug === slug || productSlug(entry) === slug,
      )
      if (match?.variantRefs?.length) {
        return {
          product: toProductDetailFromStale(match),
          reviews: [],
          source: 'api',
        }
      }
    }
    // Transient API failure with no usable stale data → error boundary (not 404).
    throw error
  }
})

/**
 * Related rail for PDP. Leaf categories (e.g. wallets) often have 1 SKU —
 * broaden to parent department, then shop-wide, so the page never dead-ends.
 */
export async function getRelatedProducts(
  product: ProductDetailData,
  limit = 8,
): Promise<ProductCardData[]> {
  try {
    const fetchLimit = Math.max(limit + 4, 12)
    const queries: Array<Parameters<typeof fetchStorefrontProductListing>[0]> = []
    if (product.categorySlug) {
      queries.push({ categorySlug: product.categorySlug, page: 1, limit: fetchLimit })
    }
    if (product.parentCategorySlug) {
      queries.push({
        parentCategorySlug: product.parentCategorySlug,
        page: 1,
        limit: fetchLimit,
      })
    }
    // Final fallback — never leave “You may also like” blank when catalog has stock.
    queries.push({ page: 1, limit: fetchLimit })

    const listings = await Promise.all(queries.map((query) => fetchStorefrontProductListing(query)))
    const seen = new Set<string>([product.id])
    const merged: typeof listings[number]['products'] = []
    for (const listing of listings) {
      for (const entry of listing.products) {
        if (seen.has(entry.id)) continue
        seen.add(entry.id)
        merged.push(entry)
        if (merged.length >= limit) break
      }
      if (merged.length >= limit) break
    }

    return merged.map((entry) => storefrontToCardData(entry))
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
