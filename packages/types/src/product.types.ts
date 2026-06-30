export interface ColorOption {
  hex: string
  name: string
}

export interface ProductCardData {
  id: string
  slug: string
  name: string
  price: number
  compareAtPrice?: number
  images: string[]
  colorOptions?: ColorOption[]
  isNewArrival: boolean
  isBestSeller: boolean
  isOnSale: boolean
  rating: number
  reviewCount: number
  category?: string
  collectionSlug?: string
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
  price: number
  compareAtPrice?: number
  stock: number
  image?: string
  isActive: boolean
}

export interface ProductDetailData extends ProductCardData {
  description: string
  shortDescription?: string
  sku?: string
  fabricContent?: string
  careInstructions?: string
  fitType?: string
  occasion?: string
  season?: string
  origin?: string
  variants: ProductVariantData[]
  tags: string[]
  metaTitle?: string
  metaDescription?: string
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
