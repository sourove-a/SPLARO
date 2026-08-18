import type { ProductFilters } from '@splaro/types'

export type StorefrontListingQuery = Pick<
  ProductFilters,
  'category' | 'collection' | 'page' | 'limit'
> & {
  categorySlug?: string
  parentCategorySlug?: string
  collectionSlug?: string
}

export const LISTING_PAGE_SIZE = 24

export type ScopedListingScope = {
  categorySlug?: string
  parentCategorySlug?: string
  collectionSlug?: string
}

/**
 * One filter per request. Category PLP and collection PLP stay separate:
 * /c/sarees → category tree only (every saree).
 * /c/jhingephool → Prisma collection only (ঝিঙেফুল brand).
 */
export function buildScopedListingAttempts(query: ScopedListingScope): ScopedListingScope[] {
  const parent = query.parentCategorySlug?.trim() || undefined
  const category = query.categorySlug?.trim() || undefined
  const collection = query.collectionSlug?.trim() || undefined
  const attempts: ScopedListingScope[] = []
  const seen = new Set<string>()

  const add = (row: ScopedListingScope) => {
    const key = [
      row.parentCategorySlug ? `p:${row.parentCategorySlug}` : '',
      row.categorySlug ? `c:${row.categorySlug}` : '',
      row.collectionSlug ? `col:${row.collectionSlug}` : '',
    ].join('|')
    if (key === '||' || seen.has(key)) return
    seen.add(key)
    attempts.push(row)
  }

  if (parent) add({ parentCategorySlug: parent })
  if (category && category !== parent) add({ categorySlug: category })
  if (!parent && !category && collection) add({ collectionSlug: collection })

  return attempts
}

export function buildListingSearchParams(query: StorefrontListingQuery): URLSearchParams {
  const params = new URLSearchParams({
    page: String(query.page ?? 1),
    limit: String(query.limit ?? LISTING_PAGE_SIZE),
  })

  if (query.collectionSlug ?? query.collection) {
    params.set('collectionSlug', query.collectionSlug ?? query.collection ?? '')
  }
  if (query.categorySlug ?? query.category) {
    params.set('categorySlug', query.categorySlug ?? query.category ?? '')
  }
  if (query.parentCategorySlug) {
    params.set('parentCategorySlug', query.parentCategorySlug)
  }

  return params
}
