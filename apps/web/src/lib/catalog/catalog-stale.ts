import type { StorefrontProduct } from '@/data/storefront'

type CatalogSource = 'api' | 'api-unavailable' | 'empty'

interface CachedCatalog {
  products: (StorefrontProduct & { slug?: string })[]
  source: CatalogSource
  total?: number
  totalPages?: number
  page?: number
}

/** In-process stale catalog — survives transient API outages between requests. */
let lastGoodCatalog: CachedCatalog | null = null

export function rememberGoodCatalog(catalog: CachedCatalog): void {
  if (catalog.source === 'api' && catalog.products.length > 0) {
    lastGoodCatalog = {
      products: catalog.products,
      source: 'api',
      ...(catalog.total != null ? { total: catalog.total } : {}),
      ...(catalog.totalPages != null ? { totalPages: catalog.totalPages } : {}),
      ...(catalog.page != null ? { page: catalog.page } : {}),
    }
  }
}

export function getStaleCatalog(): CachedCatalog | null {
  if (!lastGoodCatalog?.products.length) return null
  return { ...lastGoodCatalog, source: 'api' }
}

export function resolveCatalogFailure(fallback: CachedCatalog): CachedCatalog {
  return getStaleCatalog() ?? fallback
}
