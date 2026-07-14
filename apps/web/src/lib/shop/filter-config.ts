import {
  DEFAULT_SHOP_FILTERS,
  mergeShopFilters,
  type ShopFiltersConfig,
  type ShopPriceBandConfig,
  type ShopSortValue,
} from '@splaro/types'

export type { ShopFiltersConfig, ShopSortValue }

export { DEFAULT_SHOP_FILTERS, mergeShopFilters }

export type CatalogSortOption = string

export function getEnabledSortLabels(config: ShopFiltersConfig): string[] {
  return config.sortOptions.filter((option) => option.enabled).map((option) => option.label)
}

export function getEnabledPriceLabels(config: ShopFiltersConfig): string[] {
  return config.priceBands.filter((band) => band.enabled).map((band) => band.label)
}

export function getEnabledMobilePriceChips(config: ShopFiltersConfig) {
  return config.mobilePriceChips
    .filter((chip) => chip.enabled)
    .map((chip) => ({
      id: chip.id,
      label: chip.label,
      min: chip.min ?? 0,
      max: chip.max,
    }))
}

export function getDefaultSortLabel(config: ShopFiltersConfig): string {
  return (
    config.sortOptions.find((option) => option.enabled && option.value === 'default')?.label ??
    config.sortOptions.find((option) => option.enabled)?.label ??
    'Default'
  )
}

export function getDefaultPriceLabel(config: ShopFiltersConfig): string {
  return (
    config.priceBands.find((band) => band.enabled && band.id === 'all')?.label ??
    config.priceBands.find((band) => band.enabled)?.label ??
    config.labels.all
  )
}

export function findSortOptionByLabel(config: ShopFiltersConfig, label: string) {
  return config.sortOptions.find((option) => option.label === label)
}

export function findPriceBandByLabel(config: ShopFiltersConfig, label: string): ShopPriceBandConfig | undefined {
  return config.priceBands.find((band) => band.label === label)
}

export function matchesPriceBand(price: number, band: ShopPriceBandConfig): boolean {
  if (band.id === 'all' || (band.min === null && band.max === null)) return true
  if (band.min !== null && band.max !== null) {
    return price >= band.min && price <= band.max
  }
  if (band.max !== null) return price < band.max
  if (band.min !== null) return price > band.min
  return true
}

export function compareProductsBySort(
  a: { price: number; id: string },
  b: { price: number; id: string },
  sortLabel: string,
  config: ShopFiltersConfig,
  isBestSeller: (product: { id: string }) => boolean,
): number {
  const option = findSortOptionByLabel(config, sortLabel)
  const value: ShopSortValue = option?.value ?? 'default'

  if (value === 'best-selling') {
    const bestDiff = Number(isBestSeller(b)) - Number(isBestSeller(a))
    if (bestDiff !== 0) return bestDiff
    return 0
  }
  if (value === 'price-asc') return a.price - b.price
  if (value === 'price-desc') return b.price - a.price
  if (value === 'newest') return b.id.localeCompare(a.id)
  return 0
}

export function mobileSortFromCatalog(sort: CatalogSortOption, config: ShopFiltersConfig): string {
  const option = findSortOptionByLabel(config, sort)
  if (!option) return 'Recommended'
  if (option.value === 'newest') return 'Newest'
  if (option.value === 'price-asc') return 'Price: Low to High'
  if (option.value === 'price-desc') return 'Price: High to Low'
  if (option.value === 'best-selling') return 'Best Selling'
  return 'Recommended'
}

export function catalogSortFromMobile(sort: string, config: ShopFiltersConfig): CatalogSortOption {
  if (sort === 'Newest') {
    return config.sortOptions.find((option) => option.value === 'newest')?.label ?? 'Newest'
  }
  if (sort === 'Price: Low to High') {
    return config.sortOptions.find((option) => option.value === 'price-asc')?.label ?? 'Price low to high'
  }
  if (sort === 'Price: High to Low') {
    return config.sortOptions.find((option) => option.value === 'price-desc')?.label ?? 'Price high to low'
  }
  if (sort === 'Best Selling') {
    return config.sortOptions.find((option) => option.value === 'best-selling')?.label ?? 'Best Selling'
  }
  return getDefaultSortLabel(config)
}

export function getMobileSortOptions(config: ShopFiltersConfig): string[] {
  const labels = config.sortOptions
    .filter((option) => option.enabled)
    .map((option) => {
      if (option.value === 'default') return 'Recommended'
      if (option.value === 'newest') return 'Newest'
      if (option.value === 'price-asc') return 'Price: Low to High'
      if (option.value === 'price-desc') return 'Price: High to Low'
      if (option.value === 'best-selling') return 'Best Selling'
      return option.label
    })
  return labels.length ? labels : ['Recommended']
}
