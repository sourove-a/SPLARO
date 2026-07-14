export type ShopSortValue = 'default' | 'newest' | 'price-asc' | 'price-desc' | 'best-selling'

export interface ShopSortOptionConfig {
  id: string
  label: string
  value: ShopSortValue
  enabled: boolean
}

export interface ShopPriceBandConfig {
  id: string
  label: string
  min: number | null
  max: number | null
  enabled: boolean
}

export interface ShopFilterLabelsConfig {
  color: string
  size: string
  price: string
  sort: string
  all: string
}

export interface ShopFiltersConfig {
  labels: ShopFilterLabelsConfig
  sortOptions: ShopSortOptionConfig[]
  priceBands: ShopPriceBandConfig[]
  mobilePriceChips: ShopPriceBandConfig[]
  showColorFilter: boolean
  showSizeFilter: boolean
  showPriceFilter: boolean
  showSortFilter: boolean
}

export const DEFAULT_SHOP_FILTERS: ShopFiltersConfig = {
  labels: {
    color: 'Color',
    size: 'Size',
    price: 'Price',
    sort: 'Sort',
    all: 'All',
  },
  sortOptions: [
    { id: 'default', label: 'Default', value: 'default', enabled: true },
    { id: 'newest', label: 'Newest', value: 'newest', enabled: true },
    { id: 'price-asc', label: 'Price low to high', value: 'price-asc', enabled: true },
    { id: 'price-desc', label: 'Price high to low', value: 'price-desc', enabled: true },
  ],
  priceBands: [
    { id: 'all', label: 'All', min: null, max: null, enabled: true },
    { id: 'under-6k', label: 'Under BDT 6,000', min: null, max: 6000, enabled: true },
    { id: '6k-10k', label: 'BDT 6,000 – 10,000', min: 6000, max: 10000, enabled: true },
    { id: 'above-10k', label: 'Above BDT 10,000', min: 10000, max: null, enabled: true },
  ],
  mobilePriceChips: [
    { id: 'under-1k', label: 'Under ৳1,000', min: 0, max: 1000, enabled: true },
    { id: '1k-3k', label: '৳1,000 – ৳3,000', min: 1000, max: 3000, enabled: true },
    { id: '3k-5k', label: '৳3,000 – ৳5,000', min: 3000, max: 5000, enabled: true },
    { id: '5k-plus', label: '৳5,000+', min: 5000, max: null, enabled: true },
  ],
  showColorFilter: true,
  showSizeFilter: true,
  showPriceFilter: true,
  showSortFilter: true,
}

function mergePriceBands(
  defaults: ShopPriceBandConfig[],
  incoming: ShopPriceBandConfig[] | undefined,
): ShopPriceBandConfig[] {
  if (!incoming?.length) return defaults.map((band) => ({ ...band }))
  const byId = new Map(incoming.map((band) => [band.id, band]))
  return defaults.map((band) => {
    const saved = byId.get(band.id)
    if (!saved) return { ...band }
    return {
      ...band,
      ...saved,
      min: saved.min ?? null,
      max: saved.max ?? null,
    }
  })
}

function mergeSortOptions(
  defaults: ShopSortOptionConfig[],
  incoming: ShopSortOptionConfig[] | undefined,
): ShopSortOptionConfig[] {
  if (!incoming?.length) return defaults.map((option) => ({ ...option }))
  const byId = new Map(incoming.map((option) => [option.id, option]))
  return defaults.map((option) => {
    const saved = byId.get(option.id)
    return saved ? { ...option, ...saved } : { ...option }
  })
}

export function mergeShopFilters(input: ShopFiltersConfig | undefined): ShopFiltersConfig {
  const base = DEFAULT_SHOP_FILTERS
  if (!input) return { ...base }

  return {
    labels: { ...base.labels, ...input.labels },
    sortOptions: mergeSortOptions(base.sortOptions, input.sortOptions),
    priceBands: mergePriceBands(base.priceBands, input.priceBands),
    mobilePriceChips: mergePriceBands(base.mobilePriceChips, input.mobilePriceChips),
    showColorFilter: input.showColorFilter ?? base.showColorFilter,
    showSizeFilter: input.showSizeFilter ?? base.showSizeFilter,
    showPriceFilter: input.showPriceFilter ?? base.showPriceFilter,
    showSortFilter: input.showSortFilter ?? base.showSortFilter,
  }
}
