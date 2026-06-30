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
