export type Category = 'All' | 'Summer Edition' | 'Men' | 'Women' | 'Kids' | 'Footwear' | 'Accessories'
export type ProductStatus = 'Ready' | 'Limited' | 'New'

export interface ColorOption {
  id: string
  hex: string
  name: string
  image: string
}

export interface StorefrontVariantRef {
  /** Real database variant id — required for cart sync and order placement */
  id: string
  size?: string
  colorHex?: string
  stock: number
  isActive: boolean
}

export interface StorefrontProduct {
  id: string
  name: string
  code: string
  category: Exclude<Category, 'All'>
  /** Leaf category slug from API (e.g. wallets). */
  categorySlug?: string
  /** Leaf category display name from API (e.g. Polo Shirt). */
  categoryName?: string
  slug?: string
  tags?: string[]
  /** True when tagged/categorized Unisex — show clearly on card + PDP. */
  isUnisex?: boolean
  /** Price in Bangladesh Taka (BDT) */
  price: number
  compareAtPrice?: number
  colors: string[]
  colorOptions?: ColorOption[]
  sizes: string[]
  status: ProductStatus
  /** When false, card shows Out Of Stock dock. Derived from API variants when live. */
  inStock?: boolean
  /** Sum of active variant stock — drives In Stock / Low Stock / Only N Left. */
  stockUnits?: number
  isNewArrival?: boolean
  isBestSeller?: boolean
  image: string
  hoverImage: string
  media?: { type: 'image' | 'video'; url: string; alt?: string }[]
  fit: string
  material: string
  /** Real API variants (id + size + colorHex) so quick-add can send a valid variantId */
  variantRefs?: StorefrontVariantRef[]
  /** Aggregate rating from API — only shown when reviewCount > 0 */
  rating?: number
  reviewCount?: number
}

export function isStorefrontNewArrival(product: StorefrontProduct) {
  return product.isNewArrival === true || product.status === 'New'
}

export function isStorefrontBestSeller(product: StorefrontProduct) {
  return product.isBestSeller === true || product.status === 'Limited'
}

export interface CollectionCard {
  slug: string
  label: string
  image: string
  count: number
}

export const categories: Category[] = ['All', 'Men', 'Women', 'Kids', 'Footwear', 'Accessories']

export const shopFilterMenuCategories: Category[] = ['All', 'Women', 'Kids', 'Footwear', 'Accessories']

export const sizes = [
  'All',
  'XS',
  'S',
  'M',
  'L',
  'XL',
  '2Y',
  '4Y',
  '6Y',
  '8Y',
  '38',
  '39',
  '40',
  '41',
  '42',
]

export const colorNames = ['All', 'White', 'Blue', 'Grey', 'Pink', 'Black'] as const

export const sortOptions = ['Default', 'Newest', 'Price low to high', 'Price high to low'] as const

export const priceFilters = [
  'All',
  'Under BDT 6,000',
  'BDT 6,000 – 10,000',
  'Above BDT 10,000',
] as const

export const PRICE_FILTER_LOW = 6000
export const PRICE_FILTER_HIGH = 10000


export const products: StorefrontProduct[] = []


export function slugFromCategory(category: Exclude<Category, 'All'>): string {
  return category.toLowerCase().replace(/\s+/g, '-')
}

export function categoryFromSlug(slug: string): Exclude<Category, 'All'> | null {
  const found = (categories.filter((c) => c !== 'All') as Exclude<Category, 'All'>[]).find(
    (c) => slugFromCategory(c) === slug,
  )
  return found ?? null
}

export function colorGroup(hex: string): string {
  const h = hex.toLowerCase()
  if (['#f2f0e8', '#f5f5f0', '#ece7dd', '#f6efe5', '#f4f0e6', '#dad6cc', '#d8d6ce', '#f6d6d2', '#f7c9d7', '#e9d4ef', '#c9c1b5'].includes(h)) return 'White'
  if (['#b8c6bd', '#8dc7c8', '#8fbfc6', '#c8d5c4', '#1f2a2e', '#253036'].includes(h)) return 'Blue'
  if (['#d7bca2', '#c9c1b5', '#dad6cc', '#d8d6ce'].includes(h)) return 'Grey'
  if (['#f6d6d2', '#f7c9d7', '#f0b350', '#f1c34b', '#e9d4ef'].includes(h)) return 'Pink'
  if (['#111111', '#222222', '#121212', '#101114', '#1f2a2e', '#253036'].includes(h)) return 'Black'
  return 'White'
}

const SIZE_SORT_ORDER = ['XS', 'S', 'M', 'L', 'XL', '2Y', '4Y', '6Y', '8Y', '10Y', '12Y'] as const
const COLOR_SORT_ORDER = ['White', 'Black', 'Grey', 'Blue', 'Brown', 'Beige', 'Pink', 'Red', 'Green'] as const

export type ShopSizeKind = 'apparel' | 'kids' | 'footwear'

/** Classify a size token for category-aware filter UI. */
export function classifyShopSize(size: string): ShopSizeKind {
  if (/^\d+Y$/i.test(size)) return 'kids'
  if (/^\d+$/.test(size)) return 'footwear'
  return 'apparel'
}

export function getShopSizeKindForCategory(category: Category): ShopSizeKind | null {
  if (category === 'All') return null
  if (category === 'Kids') return 'kids'
  if (category === 'Footwear') return 'footwear'
  return 'apparel'
}

export function getShopSizeSectionMeta(category: Category): {
  title: string
  hint: string
  enabled: boolean
} {
  const kind = getShopSizeKindForCategory(category)
  if (!kind) {
    return {
      title: 'Size',
      hint: 'Select a category first to see the right sizes.',
      enabled: false,
    }
  }
  if (kind === 'kids') {
    return {
      title: 'Size',
      hint: 'Kids age sizes',
      enabled: true,
    }
  }
  if (kind === 'footwear') {
    return {
      title: 'Size',
      hint: 'Shoe sizes (EU)',
      enabled: true,
    }
  }
  return {
    title: 'Size',
    hint: 'Clothing sizes',
    enabled: true,
  }
}

export function sortShopSizes(values: string[], category?: Category): string[] {
  const scoped = category && category !== 'All' ? category : undefined
  const footwear = scoped === 'Footwear'
  const numeric = values.length > 0 && values.every((size) => /^\d+$/.test(size))

  if (footwear || numeric) {
    return [...values].sort((a, b) => Number(a) - Number(b))
  }

  return [...values].sort((a, b) => {
    const ai = SIZE_SORT_ORDER.indexOf(a as (typeof SIZE_SORT_ORDER)[number])
    const bi = SIZE_SORT_ORDER.indexOf(b as (typeof SIZE_SORT_ORDER)[number])
    if (ai === -1 && bi === -1) return a.localeCompare(b)
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })
}

function productsInCategory(catalog: StorefrontProduct[], category: Category) {
  if (category === 'All') return catalog
  return catalog.filter((product) => product.category === category)
}

/** Size filter options scoped to the active shop category. */
export function getShopSizeOptions(catalog: StorefrontProduct[], category: Category): string[] {
  const kind = getShopSizeKindForCategory(category)
  if (!kind) return ['All']

  const unique = [
    ...new Set(
      productsInCategory(catalog, category)
        .flatMap((product) => product.sizes)
        .filter((size) => classifyShopSize(size) === kind),
    ),
  ]

  return ['All', ...sortShopSizes(unique, category)]
}

/** Color filter options scoped to the active shop category. */
export function getShopColorOptions(catalog: StorefrontProduct[], category: Category): string[] {
  const groups = new Set<string>()

  for (const product of productsInCategory(catalog, category)) {
    for (const hex of product.colors) {
      groups.add(colorGroup(hex))
    }
  }

  const sorted = [...groups].sort((a, b) => {
    const ai = COLOR_SORT_ORDER.indexOf(a as (typeof COLOR_SORT_ORDER)[number])
    const bi = COLOR_SORT_ORDER.indexOf(b as (typeof COLOR_SORT_ORDER)[number])
    if (ai === -1 && bi === -1) return a.localeCompare(b)
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })

  return ['All', ...sorted]
}

export const collectionCards: CollectionCard[] = [
  { slug: 'summer-edition', label: 'Summer Edition', image: '', count: 0 },
  { slug: 'men', label: 'Men', image: '', count: 0 },
  { slug: 'women', label: 'Women', image: '', count: 0 },
  { slug: 'kids', label: 'Kids', image: '', count: 0 },
  { slug: 'footwear', label: 'Footwear', image: '', count: 0 },
  { slug: 'accessories', label: 'Accessories', image: '', count: 0 },
]
