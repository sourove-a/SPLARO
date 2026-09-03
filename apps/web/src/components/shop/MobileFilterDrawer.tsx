'use client'

import '@/styles/pages/shop.css'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from '@/lib/motion/react'
import { Check, ChevronDown, X } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { pluralize } from '@/lib/utils/pluralize'
import { formatMobileBdt, isMobilePriceRangeActive } from '@/lib/shop/mobile-filter'
import {
  catalogSortFromMobile,
  getEnabledMobilePriceChips,
  getMobileSortOptions,
  mobileSortFromCatalog,
} from '@/lib/shop/filter-config'
import { type CatalogSortOption, type MobileSortOption } from '@/lib/shop/mobile-filter'
import { useStorefrontSettings } from '@/components/providers/StorefrontSettingsProvider'
import { getShopSizeSectionMeta, type Category } from '@/data/storefront'
import { useOverlayScrollLock } from '@/hooks/useOverlayScrollLock'
import { SETTLE } from '@/lib/motion/config'

type FilterSectionId = 'sort' | 'color' | 'size' | 'price'

const COLOR_SWATCH: Record<string, string> = {
  White: '#f5f5f3',
  Black: '#111111',
  Grey: '#9ca3af',
  Blue: '#4a6fa5',
  Brown: '#8b6914',
  Beige: '#d4c4a8',
  Pink: '#e8a0bf',
  Red: '#c0392b',
  Green: '#4a7c59',
}

interface PriceBounds {
  min: number
  max: number
}

interface MobileFilterDrawerProps {
  open: boolean
  onClose: () => void
  resultCount: number
  activeCategory: Category
  colorOptions: readonly string[]
  sizeOptions: readonly string[]
  selectedColor: string
  selectedSize: string
  priceBounds: PriceBounds
  priceMin: number | null
  priceMax: number | null
  /** Sort lives in the same sheet — one place to refine, like the rest of the market. */
  sortBy?: CatalogSortOption
  onSortChange?: (value: CatalogSortOption) => void
  onColorChange: (value: string) => void
  onSizeChange: (value: string) => void
  onPriceRangeChange: (min: number | null, max: number | null) => void
  onClear: () => void
}

function FilterRow({
  id,
  title,
  summary,
  hint,
  expanded,
  onToggle,
  children,
}: {
  id: FilterSectionId
  title: string
  summary?: string | undefined
  hint?: string | undefined
  expanded: boolean
  onToggle: (id: FilterSectionId) => void
  children: ReactNode
}) {
  return (
    <section className={cn('mfs__row', expanded && 'mfs__row--open')}>
      <button
        type="button"
        className="mfs__row-trigger"
        aria-expanded={expanded}
        onClick={() => onToggle(id)}
      >
        <span className="mfs__row-copy">
          <span className="mfs__row-title">{title}</span>
          {summary ? <span className="mfs__row-summary">{summary}</span> : null}
          {!summary && hint ? <span className="mfs__row-summary">{hint}</span> : null}
        </span>
        <ChevronDown
          className={cn('mfs__row-chevron', expanded && 'mfs__row-chevron--open')}
          strokeWidth={2}
        />
      </button>
      {/*
        Open/close is CSS (grid-template-rows 0fr → 1fr), not a height tween.
        Animating `height: auto` in JS re-measures and re-lays-out the sheet on
        every frame — on a phone that is exactly where the stutter came from.
        The grid track interpolates on the compositor's schedule instead, and
        the content stays mounted so a selection inside never remounts.
      */}
      <div className="mfs__row-body" aria-hidden={!expanded}>
        {/* Clip layer carries no padding of its own — a padded grid item has a
            minimum height, and the row would never close past it. */}
        <div className="mfs__row-clip">
          <div className="mfs__row-inner">{children}</div>
        </div>
      </div>
    </section>
  )
}

function PriceRangeSlider({
  bounds,
  valueMin,
  valueMax,
  onChange,
}: {
  bounds: PriceBounds
  valueMin: number
  valueMax: number
  onChange: (min: number, max: number) => void
}) {
  const span = Math.max(bounds.max - bounds.min, 1)
  const lowPct = ((valueMin - bounds.min) / span) * 100
  const highPct = ((valueMax - bounds.min) / span) * 100

  const setMin = (next: number) => {
    const clamped = Math.min(Math.max(bounds.min, next), valueMax)
    onChange(clamped, valueMax)
  }

  const setMax = (next: number) => {
    const clamped = Math.max(Math.min(bounds.max, next), valueMin)
    onChange(valueMin, clamped)
  }

  return (
    <div className="mobile-filter-drawer__price-range">
      <div className="mobile-filter-drawer__price-bounds">
        <span>{formatMobileBdt(bounds.min)}</span>
        <span>{formatMobileBdt(bounds.max)}</span>
      </div>
      <div className="mobile-filter-drawer__price-track-wrap">
        <div className="mobile-filter-drawer__price-track" />
        <div
          className="mobile-filter-drawer__price-track-fill"
          style={{ left: `${lowPct}%`, right: `${100 - highPct}%` }}
        />
        <input
          type="range"
          className="mobile-filter-drawer__price-input mobile-filter-drawer__price-input--min"
          min={bounds.min}
          max={bounds.max}
          step={100}
          value={valueMin}
          onChange={(event) => setMin(Number(event.target.value))}
          aria-label="Minimum price"
        />
        <input
          type="range"
          className="mobile-filter-drawer__price-input mobile-filter-drawer__price-input--max"
          min={bounds.min}
          max={bounds.max}
          step={100}
          value={valueMax}
          onChange={(event) => setMax(Number(event.target.value))}
          aria-label="Maximum price"
        />
      </div>
      <p className="mobile-filter-drawer__price-label">
        {formatMobileBdt(valueMin)} — {formatMobileBdt(valueMax)}
      </p>
    </div>
  )
}

export function MobileFilterDrawer({
  open,
  onClose,
  resultCount,
  activeCategory,
  colorOptions,
  sizeOptions,
  selectedColor,
  selectedSize,
  priceBounds,
  priceMin,
  priceMax,
  sortBy,
  onSortChange,
  onColorChange,
  onSizeChange,
  onPriceRangeChange,
  onClear,
}: MobileFilterDrawerProps) {
  const { config } = useStorefrontSettings()
  const shopFilters = config.shopFilters!
  const mobilePriceQuickChips = getEnabledMobilePriceChips(shopFilters)
  const reduceMotion = useReducedMotion()
  const drawerRef = useRef<HTMLElement>(null)
  const wasOpenRef = useRef(false)
  useOverlayScrollLock(open)
  const sizeMeta = useMemo(() => getShopSizeSectionMeta(activeCategory), [activeCategory])
  const sortOptions = useMemo(() => getMobileSortOptions(shopFilters), [shopFilters])
  const showSort = Boolean(shopFilters.showSortFilter && sortBy && onSortChange)
  const selectedSort = sortBy ? mobileSortFromCatalog(sortBy, shopFilters) : sortOptions[0]
  const [expandedSections, setExpandedSections] = useState<Set<FilterSectionId>>(
    () => new Set(['sort']),
  )

  const drawerMin = priceMin ?? priceBounds.min
  const drawerMax = priceMax ?? priceBounds.max
  const priceRangeActive = isMobilePriceRangeActive(priceMin, priceMax, priceBounds)

  const activeCount = useMemo(() => {
    let count = 0
    if (selectedColor !== 'All') count += 1
    if (selectedSize !== 'All') count += 1
    if (priceRangeActive) count += 1
    return count
  }, [priceRangeActive, selectedColor, selectedSize])

  useEffect(() => {
    if (!open) return
    const restoreTarget =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    document.body.dataset.filterOpen = 'true'

    // Focus the dialog itself, not its first button — a programmatic focus on the
    // close button paints a ring the shopper never asked for.
    const raf = requestAnimationFrame(() => {
      drawerRef.current?.focus({ preventScroll: true })
    })

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      const drawer = drawerRef.current
      if (event.key !== 'Tab' || !drawer) return
      const nodes = drawer.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
      if (!nodes.length) return
      const first = nodes[0]!
      const last = nodes[nodes.length - 1]!
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)

    return () => {
      cancelAnimationFrame(raf)
      delete document.body.dataset.filterOpen
      document.removeEventListener('keydown', onKey)
      restoreTarget?.focus({ preventScroll: true })
    }
  }, [open, onClose])

  /** Reopen on the section the shopper already touched; sort stays the default entry.
      Only on the open transition — re-running it on every selection slammed the
      section shut the moment the shopper picked something inside it. */
  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false
      return
    }
    if (wasOpenRef.current) return
    wasOpenRef.current = true
    const next = new Set<FilterSectionId>()
    if (selectedColor !== 'All') next.add('color')
    else if (selectedSize !== 'All') next.add('size')
    else if (priceRangeActive) next.add('price')
    if (!next.size) {
      if (shopFilters.showSortFilter) next.add('sort')
      else if (shopFilters.showColorFilter) next.add('color')
      else if (shopFilters.showSizeFilter) next.add('size')
      else if (shopFilters.showPriceFilter) next.add('price')
    }
    setExpandedSections(next)
  }, [open, selectedColor, selectedSize, priceRangeActive, shopFilters])

  useEffect(() => {
    if (!sizeMeta.enabled && selectedSize !== 'All') onSizeChange('All')
  }, [sizeMeta.enabled, selectedSize, onSizeChange])

  const toggleSection = (id: FilterSectionId) => {
    setExpandedSections((current) => {
      return current.has(id) ? new Set<FilterSectionId>() : new Set<FilterSectionId>([id])
    })
  }

  /** Merchant labels are singular ("Colour") — the empty state reads as a plural. */
  const colorLabel = shopFilters.labels.color.toLowerCase()
  const colorSummary =
    selectedColor === 'All' ? `All ${colorLabel.endsWith('s') ? colorLabel : `${colorLabel}s`}` : selectedColor
  const sizeSummary = selectedSize === 'All' ? 'All sizes' : selectedSize
  const priceSummary = priceRangeActive
    ? `${formatMobileBdt(drawerMin)} – ${formatMobileBdt(drawerMax)}`
    : 'Any price'

  const sheetTransition = reduceMotion
    ? { duration: 0 }
    : { type: 'spring' as const, stiffness: 380, damping: 36, mass: 0.78 }

  const fadeTransition = reduceMotion ? { duration: 0 } : SETTLE

  const applyLabel =
    resultCount === 0 ? 'No matching items' : `Show ${pluralize(resultCount, 'result')}`

  const panel = (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            className="mfs__backdrop"
            aria-label="Close filters"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={fadeTransition}
            onClick={onClose}
          />

          <motion.aside
            ref={drawerRef}
            className="mfs"
            role="dialog"
            aria-modal="true"
            aria-label="Filter products"
            tabIndex={-1}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={sheetTransition}
          >
            <div className="mfs__sheet">
              <header className="mfs__head">
                <button
                  type="button"
                  className="mfs__close"
                  onClick={onClose}
                  aria-label="Close filters"
                >
                  <X className="h-4 w-4" strokeWidth={2} />
                </button>
                <h2 className="mfs__title">Filters</h2>
                <button
                  type="button"
                  className="mfs__reset"
                  onClick={onClear}
                  disabled={activeCount === 0}
                >
                  Reset
                </button>
              </header>

              <div className="mfs__body" data-lenis-prevent>
                {showSort ? (
                  <FilterRow
                    id="sort"
                    title="Sort by"
                    summary={expandedSections.has('sort') ? undefined : selectedSort}
                    expanded={expandedSections.has('sort')}
                    onToggle={toggleSection}
                  >
                    <div className="mfs__radios" role="radiogroup" aria-label="Sort options">
                      {sortOptions.map((option) => {
                        const isSelected = selectedSort === option
                        return (
                          <button
                            key={option}
                            type="button"
                            role="radio"
                            aria-checked={isSelected}
                            className="mfs__radio-row"
                            onClick={() =>
                              onSortChange?.(
                                catalogSortFromMobile(option as MobileSortOption, shopFilters),
                              )
                            }
                          >
                            <span className="mfs__radio-label">{option}</span>
                            <span
                              className={cn('mfs__radio', isSelected && 'mfs__radio--on')}
                              aria-hidden
                            />
                          </button>
                        )
                      })}
                    </div>
                  </FilterRow>
                ) : null}

                {shopFilters.showColorFilter ? (
                  <FilterRow
                    id="color"
                    title={shopFilters.labels.color}
                    summary={colorSummary}
                    expanded={expandedSections.has('color')}
                    onToggle={toggleSection}
                  >
                    <div className="mobile-filter-drawer__color-grid">
                      {colorOptions.map((option) => {
                        const selected = selectedColor === option
                        const swatch = option !== 'All' ? COLOR_SWATCH[option] : undefined
                        return (
                          <button
                            key={option}
                            type="button"
                            className={cn(
                              'mobile-filter-drawer__color-chip',
                              selected && 'mobile-filter-drawer__color-chip--active',
                            )}
                            onClick={() => onColorChange(option)}
                            aria-pressed={selected}
                          >
                            {swatch ? (
                              <span className="mobile-filter-drawer__color-swatch-wrap">
                                <span
                                  className="mobile-filter-drawer__color-swatch"
                                  style={{ backgroundColor: swatch }}
                                  aria-hidden
                                />
                                {selected ? (
                                  <span
                                    className="mobile-filter-drawer__color-swatch-check"
                                    aria-hidden
                                  >
                                    <Check className="h-2.5 w-2.5" strokeWidth={3} />
                                  </span>
                                ) : null}
                              </span>
                            ) : (
                              <span className="mobile-filter-drawer__color-swatch mobile-filter-drawer__color-swatch--all" />
                            )}
                            <span>{option}</span>
                          </button>
                        )
                      })}
                    </div>
                  </FilterRow>
                ) : null}

                {shopFilters.showSizeFilter ? (
                  <FilterRow
                    id="size"
                    title={shopFilters.labels.size}
                    summary={sizeMeta.enabled ? sizeSummary : undefined}
                    hint={sizeMeta.enabled ? undefined : 'Pick a category first'}
                    expanded={expandedSections.has('size')}
                    onToggle={toggleSection}
                  >
                    {sizeMeta.enabled ? (
                      <div
                        className={cn(
                          'mobile-filter-drawer__size-grid',
                          sizeMeta.hint.includes('Shoe') &&
                            'mobile-filter-drawer__size-grid--footwear',
                          sizeMeta.hint.includes('Age') && 'mobile-filter-drawer__size-grid--kids',
                        )}
                      >
                        {sizeOptions.map((option) => {
                          const selected = selectedSize === option
                          return (
                            <button
                              key={option}
                              type="button"
                              className={cn(
                                'mobile-filter-drawer__size',
                                selected && 'mobile-filter-drawer__size--active',
                              )}
                              onClick={() => onSizeChange(option)}
                              aria-pressed={selected}
                            >
                              {option}
                            </button>
                          )
                        })}
                      </div>
                    ) : (
                      <p className="mobile-filter-drawer__empty-note">
                        Select a category first to see the right sizes.
                      </p>
                    )}
                  </FilterRow>
                ) : null}

                {shopFilters.showPriceFilter ? (
                  <FilterRow
                    id="price"
                    title={shopFilters.labels.price}
                    summary={priceSummary}
                    expanded={expandedSections.has('price')}
                    onToggle={toggleSection}
                  >
                    <PriceRangeSlider
                      bounds={priceBounds}
                      valueMin={drawerMin}
                      valueMax={drawerMax}
                      onChange={(min, max) => onPriceRangeChange(min, max)}
                    />
                    <div className="mobile-filter-drawer__price-chips">
                      <button
                        type="button"
                        className={cn(
                          'mobile-filter-drawer__chip',
                          !priceRangeActive && 'mobile-filter-drawer__chip--active',
                        )}
                        onClick={() => onPriceRangeChange(null, null)}
                      >
                        All prices
                      </button>
                      {mobilePriceQuickChips.map((chip) => {
                        const chipMax = chip.max ?? priceBounds.max
                        const selected =
                          priceRangeActive && drawerMin === chip.min && drawerMax === chipMax
                        return (
                          <button
                            key={chip.id}
                            type="button"
                            className={cn(
                              'mobile-filter-drawer__chip',
                              selected && 'mobile-filter-drawer__chip--active',
                            )}
                            onClick={() => onPriceRangeChange(chip.min, chipMax)}
                          >
                            {chip.label}
                          </button>
                        )
                      })}
                    </div>
                  </FilterRow>
                ) : null}
              </div>

              <footer className="mfs__foot">
                <button
                  type="button"
                  className={cn('mfs__apply', resultCount === 0 && 'mfs__apply--empty')}
                  onClick={onClose}
                >
                  {applyLabel}
                </button>
              </footer>
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  )

  if (typeof document === 'undefined') return null
  return createPortal(panel, document.body)
}
