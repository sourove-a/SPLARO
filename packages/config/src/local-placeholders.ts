/**
 * Self-hosted image defaults — no Unsplash hotlinks for seed / nav / editorial.
 * On VPS (`SPLARO_VPS=1`) Next image optimizer is off; size lives in the file URL.
 * Admin uploads should be WebP (or pre-sized JPEG) for catalog photography.
 */
export const LOCAL_PRODUCT_PLACEHOLDER = '/images/placeholder-product.jpg'

export const LOCAL_EDITORIAL = {
  menNew: '/images/hero/new-season-828.webp',
  menBest: '/images/hero/summer-828.webp',
  menSummer: '/images/hero/summer-828.webp',
  womenNew: '/images/hero/women-collection-828.webp',
  womenBest: '/images/hero/women-collection-828.webp',
  womenPremium: '/images/hero/women-collection-828.webp',
  kidsPanjabi: '/images/hero/new-season-828.webp',
  kidsDresses: '/images/hero/summer-828.webp',
  kidsSchool: '/images/hero/new-season-828.webp',
  footwearSneakers: LOCAL_PRODUCT_PLACEHOLDER,
  footwearLoafers: LOCAL_PRODUCT_PLACEHOLDER,
  footwearSandals: LOCAL_PRODUCT_PLACEHOLDER,
  accessoriesEyewear: LOCAL_PRODUCT_PLACEHOLDER,
  accessoriesNew: LOCAL_PRODUCT_PLACEHOLDER,
  accessoriesBest: LOCAL_PRODUCT_PLACEHOLDER,
} as const
