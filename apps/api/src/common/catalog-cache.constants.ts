/** Redis TTL (seconds) for storefront catalog — invalidated on admin write. */
export const CATALOG_CACHE_TTL = {
  products: 300,
  productDetail: 300,
  productIds: 300,
  categories: 600,
  collections: 600,
} as const
