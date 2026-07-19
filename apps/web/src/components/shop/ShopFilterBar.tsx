'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, SlidersHorizontal } from 'lucide-react'
import { AnimatePresence, LayoutGroup, m, useReducedMotion } from '@/lib/motion/react'
import { cn } from '@/lib/utils/cn'
import { HorizontalScrollRail } from '@/components/ui/HorizontalScrollRail'
import { ShopFilterDropdown } from '@/components/shop/ShopFilterDropdown'
import { MobileFilterDrawer } from '@/components/shop/MobileFilterDrawer'
import { MobileSortSheet } from '@/components/shop/MobileSortSheet'
import {
  isMobilePriceRangeActive,
  isDefaultSort,
  type CatalogSortOption,
} from '@/lib/shop/mobile-filter'
import {
  getDefaultPriceLabel,
  getDefaultSortLabel,
  getEnabledPriceLabels,
  getEnabledSortLabels,
} from '@/lib/shop/filter-config'
import { useStorefrontSettings } from '@/components/providers/StorefrontSettingsProvider'
import { type Category } from '@/data/storefront'

type FilterKey = 'color' | 'size' | 'price' | 'sort' | null
export type ShopGridDensity = 1 | 2

interface ShopFilterBarProps {
  categories: Category[]
  activeCategory: Category
  onCategoryChange: (category: Category) => void
  /** Department / collection PLPs already have header nav — hide duplicate All/Men/Women pills. */
  showCategoryNav?: boolean
  colorOptions: readonly string[]
  sizeOptions: readonly string[]
  selectedColor: string
  selectedSize: string
  selectedPrice: string
  sortBy: CatalogSortOption
  priceBounds: { min: number; max: number }
  priceMin: number | null
  priceMax: number | null
  resultCount: number
  openFilter: FilterKey
  onOpenFilterChange: (key: FilterKey) => void
  onColorChange: (value: string) => void
  onSizeChange: (value: string) => void
  onPriceChange: (value: string) => void
  onPriceRangeChange: (min: number | null, max: number | null) => void
  onSortChange: (value: CatalogSortOption) => void
  onClearFilters: () => void
  /** Mobile product grid columns — default 2. */
  gridDensity?: ShopGridDensity
  onGridDensityChange?: (density: ShopGridDensity) => void
}

export function ShopFilterBar({
  categories,
  activeCategory,
  onCategoryChange,
  showCategoryNav = true,
  colorOptions,
  sizeOptions,
  selectedColor,
  selectedSize,
  selectedPrice,
  sortBy,
  priceBounds,
  priceMin,
  priceMax,
  resultCount,
  openFilter,
  onOpenFilterChange,
  onColorChange,
  onSizeChange,
  onPriceChange,
  onPriceRangeChange,
  onSortChange,
  onClearFilters,
  gridDensity = 2,
  onGridDensityChange,
}: ShopFilterBarProps) {
  const { config } = useStorefrontSettings()
  const shopFilters = config.shopFilters!
  const sortOptions = getEnabledSortLabels(shopFilters)
  const priceFilters = getEnabledPriceLabels(shopFilters)
  const defaultSortLabel = getDefaultSortLabel(shopFilters)
  const defaultPriceLabel = getDefaultPriceLabel(shopFilters)
  const reducedMotion = useReducedMotion()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [sortSheetOpen, setSortSheetOpen] = useState(false)
  const sortDisplay = isDefaultSort(sortBy, shopFilters) ? defaultSortLabel : sortBy
  const mobilePriceRangeActive = isMobilePriceRangeActive(priceMin, priceMax, priceBounds)

  useEffect(() => {
    const filterOpen = drawerOpen || sortSheetOpen || openFilter !== null
    if (filterOpen) document.body.setAttribute('data-filter-open', 'true')
    else document.body.removeAttribute('data-filter-open')
    return () => document.body.removeAttribute('data-filter-open')
  }, [drawerOpen, sortSheetOpen, openFilter])

  const activeFilterCount = useMemo(() => {
    let count = 0
    if (selectedColor !== 'All') count += 1
    if (selectedSize !== 'All') count += 1
    if (mobilePriceRangeActive || selectedPrice !== defaultPriceLabel) count += 1
    return count
  }, [
    mobilePriceRangeActive,
    selectedColor,
    selectedPrice,
    selectedSize,
    defaultPriceLabel,
  ])

  const closeDrawer = useCallback(() => setDrawerOpen(false), [])
  const closeSortSheet = useCallback(() => setSortSheetOpen(false), [])

  return (
    <div className="shop-filter-bar">
      {typeof document !== 'undefined'
        ? createPortal(
            <AnimatePresence initial={false}>
              {openFilter && !drawerOpen ? (
                <m.button
                  type="button"
                  className="shop-filter-dropdown__backdrop"
                  aria-label="Close filters"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: reducedMotion ? 0.06 : 0.28, ease: [0.16, 1, 0.3, 1] }}
                  onClick={() => onOpenFilterChange(null)}
                />
              ) : null}
            </AnimatePresence>,
            document.body,
          )
        : null}

      <div className="shop-filter-bar__sticky">
        <div
          className={cn(
            'shop-filter-bar__inner',
            !showCategoryNav && 'shop-filter-bar__inner--filters-only',
          )}
        >
          {showCategoryNav ? (
            <nav
              className="shop-category-pill shop-filter-bar__categories"
              aria-label="Shop categories"
            >
              <LayoutGroup id="shop-category-pills">
                <HorizontalScrollRail
                  className="shop-category-pill__rail"
                  trackClassName="shop-category-pill__track"
                  variant="pill"
                  ariaLabel="Shop categories"
                  hideArrows
                >
                  {categories.map((category) => {
                    const isActive = activeCategory === category
                    return (
                      <m.button
                        key={category}
                        type="button"
                        data-no-press=""
                        className={cn(
                          'shop-category-pill__item',
                          isActive && 'shop-category-pill__item--active',
                        )}
                        onClick={() => onCategoryChange(category)}
                        aria-current={isActive ? 'page' : undefined}
                        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                      >
                        {isActive ? (
                          <m.span
                            layoutId="shop-category-pill-active"
                            className="shop-category-pill__active-fill"
                            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                            aria-hidden
                          />
                        ) : null}
                        <span className="shop-category-pill__label">{category}</span>
                      </m.button>
                    )
                  })}
                </HorizontalScrollRail>
              </LayoutGroup>
            </nav>
          ) : null}

          <div className="shop-mobile-toolbar">
            <button
              type="button"
              className={cn(
                'shop-mobile-toolbar__filter',
                activeFilterCount > 0 && 'shop-mobile-toolbar__filter--active',
              )}
              onClick={() => {
                setSortSheetOpen(false)
                setDrawerOpen(true)
              }}
              aria-label={
                activeFilterCount > 0
                  ? `Filter, ${activeFilterCount} active`
                  : 'Filter'
              }
            >
              <SlidersHorizontal className="shop-mobile-toolbar__filter-icon" strokeWidth={2.2} />
              <span className="shop-mobile-toolbar__filter-label">Filter</span>
              {activeFilterCount > 0 ? (
                <span className="shop-mobile-toolbar__filter-count">{activeFilterCount}</span>
              ) : null}
            </button>

            <div className="shop-mobile-toolbar__density" role="group" aria-label="Product layout">
              <button
                type="button"
                className={cn(
                  'shop-mobile-toolbar__density-btn',
                  gridDensity === 1 && 'shop-mobile-toolbar__density-btn--active',
                )}
                aria-label="One product per row"
                aria-pressed={gridDensity === 1}
                onClick={() => onGridDensityChange?.(1)}
              >
                <span className="shop-mobile-toolbar__density-single" aria-hidden />
              </button>
              <button
                type="button"
                className={cn(
                  'shop-mobile-toolbar__density-btn',
                  gridDensity === 2 && 'shop-mobile-toolbar__density-btn--active',
                )}
                aria-label="Two products per row"
                aria-pressed={gridDensity === 2}
                onClick={() => onGridDensityChange?.(2)}
              >
                <span className="shop-mobile-toolbar__density-double" aria-hidden>
                  <i />
                  <i />
                  <i />
                  <i />
                </span>
              </button>
            </div>

            {shopFilters.showSortFilter ? (
              <button
                type="button"
                className={cn(
                  'shop-mobile-toolbar__sort',
                  !isDefaultSort(sortBy, shopFilters) && 'shop-mobile-toolbar__sort--active',
                )}
                onClick={() => {
                  setDrawerOpen(false)
                  setSortSheetOpen(true)
                }}
                aria-label={`Sort, ${sortDisplay}`}
              >
                <span>Sort</span>
                <ChevronDown className="shop-mobile-toolbar__sort-chevron" strokeWidth={2.2} />
              </button>
            ) : (
              <span className="shop-mobile-toolbar__sort" aria-hidden />
            )}
          </div>

          <div className="shop-filter-bar__controls">
            {shopFilters.showColorFilter ? (
              <ShopFilterDropdown
                label={shopFilters.labels.color}
                panelTitle={`Select ${shopFilters.labels.color}`}
                value={selectedColor}
                options={colorOptions}
                open={openFilter === 'color'}
                onToggle={() => onOpenFilterChange('color')}
                onClose={() => onOpenFilterChange(null)}
                onChange={onColorChange}
              />
            ) : null}
            {shopFilters.showSizeFilter ? (
              <ShopFilterDropdown
                label={shopFilters.labels.size}
                panelTitle={`Select ${shopFilters.labels.size}`}
                value={selectedSize}
                options={sizeOptions}
                open={openFilter === 'size'}
                onToggle={() => onOpenFilterChange('size')}
                onClose={() => onOpenFilterChange(null)}
                onChange={onSizeChange}
              />
            ) : null}
            {shopFilters.showPriceFilter ? (
              <ShopFilterDropdown
                label={shopFilters.labels.price}
                panelTitle={`Select ${shopFilters.labels.price}`}
                value={selectedPrice}
                options={priceFilters}
                open={openFilter === 'price'}
                onToggle={() => onOpenFilterChange('price')}
                onClose={() => onOpenFilterChange(null)}
                onChange={onPriceChange}
              />
            ) : null}
            {shopFilters.showSortFilter ? (
              <ShopFilterDropdown
                label={shopFilters.labels.sort}
                labelVariant="sort"
                sortDisplay={sortDisplay}
                panelTitle="Sort Products"
                value={isDefaultSort(sortBy, shopFilters) ? defaultSortLabel : sortBy}
                options={sortOptions}
                open={openFilter === 'sort'}
                onToggle={() => onOpenFilterChange('sort')}
                onClose={() => onOpenFilterChange(null)}
                onChange={(value) => onSortChange(value as CatalogSortOption)}
              />
            ) : null}
          </div>
        </div>
      </div>

      <MobileFilterDrawer
        open={drawerOpen}
        onClose={closeDrawer}
        resultCount={resultCount}
        activeCategory={activeCategory}
        colorOptions={colorOptions}
        sizeOptions={sizeOptions}
        selectedColor={selectedColor}
        selectedSize={selectedSize}
        priceBounds={priceBounds}
        priceMin={priceMin}
        priceMax={priceMax}
        onColorChange={onColorChange}
        onSizeChange={onSizeChange}
        onPriceRangeChange={onPriceRangeChange}
        onClear={() => {
          onClearFilters()
          setDrawerOpen(false)
        }}
      />

      <MobileSortSheet
        open={sortSheetOpen}
        sortBy={sortBy}
        onClose={closeSortSheet}
        onSortChange={onSortChange}
      />
    </div>
  )
}
