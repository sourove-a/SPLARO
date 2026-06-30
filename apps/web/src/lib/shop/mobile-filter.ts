import type { sortOptions } from '@/data/storefront'

export const mobileSortOptions = [
  'Recommended',
  'Newest',
  'Price: Low to High',
  'Price: High to Low',
  'Best Selling',
] as const

export type MobileSortOption = (typeof mobileSortOptions)[number]

export type CatalogSortOption = (typeof sortOptions)[number] | 'Best Selling'

export const mobilePriceQuickChips = [
  { id: 'under-1k', label: 'Under ৳1,000', min: 0, max: 1000 },
  { id: '1k-3k', label: '৳1,000 – ৳3,000', min: 1000, max: 3000 },
  { id: '3k-5k', label: '৳3,000 – ৳5,000', min: 3000, max: 5000 },
  { id: '5k-plus', label: '৳5,000+', min: 5000, max: null as number | null },
] as const

export function formatMobileBdt(amount: number) {
  return `৳${amount.toLocaleString('en-BD', { maximumFractionDigits: 0 })}`
}

export function mobileSortFromCatalog(sort: CatalogSortOption): MobileSortOption {
  if (sort === 'Newest') return 'Newest'
  if (sort === 'Price low to high') return 'Price: Low to High'
  if (sort === 'Price high to low') return 'Price: High to Low'
  if (sort === 'Best Selling') return 'Best Selling'
  return 'Recommended'
}

export function catalogSortFromMobile(sort: MobileSortOption): CatalogSortOption {
  if (sort === 'Newest') return 'Newest'
  if (sort === 'Price: Low to High') return 'Price low to high'
  if (sort === 'Price: High to Low') return 'Price high to low'
  if (sort === 'Best Selling') return 'Best Selling'
  return 'Default'
}

export function isMobilePriceRangeActive(
  min: number | null,
  max: number | null,
  bounds: { min: number; max: number },
) {
  if (min === null || max === null) return false
  return min > bounds.min || max < bounds.max
}
