import {
  catalogSortFromMobile as catalogSortFromMobileConfig,
  getDefaultSortLabel,
  getMobileSortOptions,
  mobileSortFromCatalog as mobileSortFromCatalogConfig,
  type CatalogSortOption,
} from '@/lib/shop/filter-config'
import { DEFAULT_SHOP_FILTERS } from '@splaro/types'

export type { CatalogSortOption }

export const mobileSortOptions = getMobileSortOptions(DEFAULT_SHOP_FILTERS)

export type MobileSortOption = string

export const mobilePriceQuickChips = DEFAULT_SHOP_FILTERS.mobilePriceChips
  .filter((chip) => chip.enabled)
  .map((chip) => ({
    id: chip.id,
    label: chip.label,
    min: chip.min ?? 0,
    max: chip.max,
  }))

export function formatMobileBdt(amount: number) {
  return `৳${amount.toLocaleString('en-BD', { maximumFractionDigits: 0 })}`
}

export function mobileSortFromCatalog(sort: CatalogSortOption): MobileSortOption {
  return mobileSortFromCatalogConfig(sort, DEFAULT_SHOP_FILTERS)
}

export function catalogSortFromMobile(sort: MobileSortOption): CatalogSortOption {
  return catalogSortFromMobileConfig(sort, DEFAULT_SHOP_FILTERS)
}

export function isMobilePriceRangeActive(
  min: number | null,
  max: number | null,
  bounds: { min: number; max: number },
) {
  if (min === null || max === null) return false
  return min > bounds.min || max < bounds.max
}

export function isDefaultSort(sort: CatalogSortOption, config = DEFAULT_SHOP_FILTERS) {
  return sort === getDefaultSortLabel(config)
}
