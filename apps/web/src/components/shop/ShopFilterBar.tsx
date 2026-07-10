'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { ShopFilterDropdown } from '@/components/shop/ShopFilterDropdown'
import { MobileFilterDrawer } from '@/components/shop/MobileFilterDrawer'
import {
  isMobilePriceRangeActive,
  type CatalogSortOption,
} from '@/lib/shop/mobile-filter'
import {
  priceFilters,
  sortOptions,
  type Category,
} from '@/data/storefront'

type FilterKey = 'color' | 'size' | 'price' | 'sort' | null

interface ShopFilterBarProps {
  categories: Category[]
  activeCategory: Category
  onCategoryChange: (category: Category) => void
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
}

export function ShopFilterBar({
  categories,
  activeCategory,
  onCategoryChange,
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
}: ShopFilterBarProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const sortDisplay = sortBy === 'Best Selling' ? 'Default' : sortBy
  const mobilePriceRangeActive = isMobilePriceRangeActive(priceMin, priceMax, priceBounds)

  useEffect(() => {
    const filterOpen = drawerOpen || openFilter !== null
    if (filterOpen) {
      document.body.setAttribute('data-filter-open', 'true')
    } else {
      document.body.removeAttribute('data-filter-open')
    }
    return () => document.body.removeAttribute('data-filter-open')
  }, [drawerOpen, openFilter])

  const activeFilterCount = useMemo(() => {
    let count = 0
    if (activeCategory !== 'All') count += 1
    if (selectedColor !== 'All') count += 1
    if (selectedSize !== 'All') count += 1
    if (mobilePriceRangeActive || selectedPrice !== 'All') count += 1
    if (sortBy !== 'Default') count += 1
    return count
  }, [
    activeCategory,
    mobilePriceRangeActive,
    selectedColor,
    selectedPrice,
    selectedSize,
    sortBy,
  ])

  const closeOpenFilter = useCallback(() => onOpenFilterChange(null), [onOpenFilterChange])
  const closeDrawer = useCallback(() => setDrawerOpen(false), [])

  return (
    <div className="shop-filter-bar">
      <div className="shop-filter-bar__sticky">
        <div className="shop-filter-bar__inner">
          <nav
            className="shop-category-pill shop-filter-bar__categories shop-filter-bar__categories--desktop"
            aria-label="Shop categories"
          >
            <div className="shop-category-pill__track" data-lenis-prevent>
              {categories.map((category) => (
                <button
                  key={category}
                  type="button"
                  className={cn(
                    'shop-category-pill__item',
                    activeCategory === category && 'shop-category-pill__item--active',
                  )}
                  onClick={() => onCategoryChange(category)}
                  aria-current={activeCategory === category ? 'page' : undefined}
                >
                  {category}
                </button>
              ))}
            </div>
          </nav>

          <nav
            className="shop-category-pill shop-filter-bar__categories shop-filter-bar__categories--mobile"
            aria-label="Shop categories"
          >
            <div className="shop-category-pill__track" data-lenis-prevent>
              {categories.map((category) => (
                <button
                  key={category}
                  type="button"
                  className={cn(
                    'shop-category-pill__item',
                    activeCategory === category && 'shop-category-pill__item--active',
                  )}
                  onClick={() => onCategoryChange(category)}
                  aria-current={activeCategory === category ? 'page' : undefined}
                >
                  {category}
                </button>
              ))}
            </div>
          </nav>

          <div className="shop-filter-bar__mobile-actions">
            <button
              type="button"
              className="shop-filter-trigger"
              onClick={() => setDrawerOpen(true)}
              aria-label={
                activeFilterCount > 0
                  ? `Open product filters, ${activeFilterCount} active`
                  : 'Open product filters'
              }
            >
              <SlidersHorizontal className="h-[1.05rem] w-[1.05rem]" strokeWidth={2.1} />
              <span className="shop-filter-trigger__label">Filter & Sort</span>
              {activeFilterCount > 0 ? (
                <span className="shop-filter-trigger__count">{activeFilterCount}</span>
              ) : null}
            </button>
            <p className="shop-filter-bar__result-hint">
              {resultCount} item{resultCount === 1 ? '' : 's'}
            </p>
          </div>

          <div className="shop-filter-bar__controls">
            <ShopFilterDropdown
              label="Color"
              panelTitle="Select Color"
              value={selectedColor}
              options={colorOptions}
              open={openFilter === 'color'}
              onToggle={() => onOpenFilterChange(openFilter === 'color' ? null : 'color')}
              onClose={closeOpenFilter}
              onChange={onColorChange}
            />
            <ShopFilterDropdown
              label="Size"
              panelTitle="Select Size"
              value={selectedSize}
              options={sizeOptions}
              open={openFilter === 'size'}
              onToggle={() => onOpenFilterChange(openFilter === 'size' ? null : 'size')}
              onClose={closeOpenFilter}
              onChange={onSizeChange}
            />
            <ShopFilterDropdown
              label="Price"
              panelTitle="Select Price"
              value={selectedPrice}
              options={priceFilters}
              open={openFilter === 'price'}
              onToggle={() => onOpenFilterChange(openFilter === 'price' ? null : 'price')}
              onClose={closeOpenFilter}
              onChange={onPriceChange}
            />
            <ShopFilterDropdown
              label="Sort"
              labelVariant="sort"
              sortDisplay={sortDisplay}
              panelTitle="Sort Products"
              value={sortBy === 'Best Selling' ? 'Default' : sortBy}
              options={sortOptions}
              open={openFilter === 'sort'}
              onToggle={() => onOpenFilterChange(openFilter === 'sort' ? null : 'sort')}
              onClose={closeOpenFilter}
              onChange={(value) => onSortChange(value as CatalogSortOption)}
            />
          </div>
        </div>
      </div>

      <MobileFilterDrawer
        open={drawerOpen}
        onClose={closeDrawer}
        resultCount={resultCount}
        categories={categories}
        activeCategory={activeCategory}
        onCategoryChange={onCategoryChange}
        colorOptions={colorOptions}
        sizeOptions={sizeOptions}
        selectedColor={selectedColor}
        selectedSize={selectedSize}
        sortBy={sortBy}
        priceBounds={priceBounds}
        priceMin={priceMin}
        priceMax={priceMax}
        onColorChange={onColorChange}
        onSizeChange={onSizeChange}
        onSortChange={onSortChange}
        onPriceRangeChange={onPriceRangeChange}
        onClear={() => {
          onClearFilters()
          setDrawerOpen(false)
        }}
      />
    </div>
  )
}
