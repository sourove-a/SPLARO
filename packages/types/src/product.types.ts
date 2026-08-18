export interface ColorOption {
  /** Canonical `#rrggbb` lowercase — storefront swatch CSS. */
  hex: string
  name: string
}

export interface ProductCardVariantRef {
  id: string
  size?: string
  colorHex?: string
  colorName?: string
  image?: string
  stock: number
  isActive: boolean
}

export interface ProductCardData {
  id: string
  slug: string
  name: string
  price: number
  compareAtPrice?: number
  images: string[]
  colorOptions?: ColorOption[]
  sizes?: string[]
  colorHexes?: string[]
  variantRefs?: ProductCardVariantRef[]
  isNewArrival: boolean
  isBestSeller: boolean
  isOnSale: boolean
  rating: number
  reviewCount: number
  category?: string
  categorySlug?: string
  /** Department slug when `categorySlug` is a leaf (e.g. wallets → accessories). */
  parentCategorySlug?: string
  collectionSlug?: string
  /** Explicit Unisex tag/category — show on card + PDP. */
  isUnisex?: boolean
  tags?: string[]
  /** Sum of active variant stock for card stock labels. */
  stockUnits?: number
  media?: ProductMediaData[]
}

export interface ProductMediaData {
  type: 'image' | 'video'
  url: string
  alt?: string
}

export interface ProductVariantData {
  id: string
  size?: string
  color?: string
  colorHex?: string
  colorName?: string
  sku?: string
  barcode?: string
  price: number
  compareAtPrice?: number
  stock: number
  image?: string
  isActive: boolean
}

export interface ProductSpecFact {
  label: string
  value: string
}

export interface ProductDetailData extends ProductCardData {
  description: string
  shortDescription?: string
  nameBn?: string
  /** Admin-written Bangla description. Absent when the admin left it blank. */
  descriptionBn?: string
  weavingType?: string
  sku?: string
  fabricContent?: string
  careInstructions?: string
  fitType?: string
  occasion?: string
  season?: string
  origin?: string
  productType?: string
  inventoryPolicy?: 'DENY' | 'CONTINUE' | 'PREORDER'
  preorderReleaseAt?: string
  dimensionsCm?: {
    length?: number
    width?: number
    height?: number
  }
  /** Product weight in grams when set in admin/catalog. */
  weightGrams?: number
  /** Structured facts from schemaMarkup.specs (dimensions, strap, closure…). */
  specs?: ProductSpecFact[]
  variants: ProductVariantData[]
  tags: string[]
  metaTitle?: string
  metaDescription?: string
  /**
   * Set only when the admin picked a brand for this product and that brand is
   * still active. Absent for own-label goods, which is the common case — the
   * PDP renders nothing rather than an empty badge.
   */
  brand?: ProductBrand
}

/** The brand badge shown on a product page. */
export interface ProductBrand {
  name: string
  slug: string
  /** Uploaded mark. When absent the badge falls back to the brand name. */
  logo?: string
}

export type SortOption =
  | 'newest'
  | 'price-asc'
  | 'price-desc'
  | 'popular'
  | 'rating'

export interface ProductFilters {
  category?: string
  collection?: string
  minPrice?: number
  maxPrice?: number
  colors?: string[]
  sizes?: string[]
  sort?: SortOption
  page?: number
  limit?: number
}
