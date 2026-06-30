'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode, type TouchEvent } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Check, ChevronDown, X } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import {
  catalogSortFromMobile,
  formatMobileBdt,
  isMobilePriceRangeActive,
  mobilePriceQuickChips,
  mobileSortFromCatalog,
  mobileSortOptions,
  type CatalogSortOption,
  type MobileSortOption,
} from '@/lib/shop/mobile-filter'
import { getShopSizeSectionMeta, type Category } from '@/data/storefront'

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

const DRAWER_EASE = [0.22, 1, 0.36, 1] as const
type FilterSectionId = 'category' | 'color' | 'size' | 'price' | 'sort'

interface PriceBounds {
  min: number
  max: number
}

interface MobileFilterDrawerProps {
  open: boolean
  onClose: () => void
  resultCount: number
  categories: readonly Category[]
  activeCategory: Category
  onCategoryChange: (category: Category) => void
  colorOptions: readonly string[]
  sizeOptions: readonly string[]
  selectedColor: string
  selectedSize: string
  sortBy: CatalogSortOption
  priceBounds: PriceBounds
  priceMin: number | null
  priceMax: number | null
  onColorChange: (value: string) => void
  onSizeChange: (value: string) => void
  onSortChange: (value: CatalogSortOption) => void
  onPriceRangeChange: (min: number | null, max: number | null) => void
  onClear: () => void
}

function AccordionSection({
  id,
  title,
  hint,
  summary,
  hasSelection,
  expanded,
  onToggle,
  children,
}: {
  id: FilterSectionId
  title: string
  hint?: string | undefined
  summary?: string | undefined
  hasSelection?: boolean | undefined
  expanded: boolean
  onToggle: (id: FilterSectionId) => void
  children: ReactNode
}) {
  return (
    <section
      className={cn(
        'mobile-filter-drawer__accordion',
        expanded && 'mobile-filter-drawer__accordion--open',
        hasSelection && 'mobile-filter-drawer__accordion--selected',
      )}
    >
      <button
        type="button"
        className="mobile-filter-drawer__accordion-trigger"
        aria-expanded={expanded}
        onClick={() => onToggle(id)}
      >
        <span className="mobile-filter-drawer__accordion-copy">
          <span className="mobile-filter-drawer__section-title-row">
            <span className="mobile-filter-drawer__section-title">{title}</span>
            {hasSelection ? <span className="mobile-filter-drawer__section-dot" aria-hidden /> : null}
          </span>
          {hint && !summary ? (
            <span className="mobile-filter-drawer__section-hint">{hint}</span>
          ) : null}
          {summary ? <span className="mobile-filter-drawer__accordion-summary">{summary}</span> : null}
        </span>
        <span className="mobile-filter-drawer__accordion-chevron-wrap">
          <ChevronDown
            className={cn(
              'mobile-filter-drawer__accordion-chevron',
              expanded && 'mobile-filter-drawer__accordion-chevron--open',
            )}
            strokeWidth={2.1}
          />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            key={id}
            className="mobile-filter-drawer__accordion-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: DRAWER_EASE }}
          >
            <div className="mobile-filter-drawer__accordion-inner">{children}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
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
  categories,
  activeCategory,
  onCategoryChange,
  colorOptions,
  sizeOptions,
  selectedColor,
  selectedSize,
  sortBy,
  priceBounds,
  priceMin,
  priceMax,
  onColorChange,
  onSizeChange,
  onSortChange,
  onPriceRangeChange,
  onClear,
}: MobileFilterDrawerProps) {
  const reduceMotion = useReducedMotion()
  const drawerRef = useRef<HTMLElement>(null)
  const touchStartX = useRef(0)
  const sizeMeta = useMemo(() => getShopSizeSectionMeta(activeCategory), [activeCategory])
  const [expandedSections, setExpandedSections] = useState<Set<FilterSectionId>>(
    () => new Set(['category']),
  )

  const drawerMin = priceMin ?? priceBounds.min
  const drawerMax = priceMax ?? priceBounds.max
  const mobileSort = mobileSortFromCatalog(sortBy)
  const priceRangeActive = isMobilePriceRangeActive(priceMin, priceMax, priceBounds)

  const activeCount = useMemo(() => {
    let count = 0
    if (activeCategory !== 'All') count += 1
    if (selectedColor !== 'All') count += 1
    if (selectedSize !== 'All') count += 1
    if (priceRangeActive) count += 1
    if (sortBy !== 'Default') count += 1
    return count
  }, [activeCategory, priceRangeActive, selectedColor, selectedSize, sortBy])

  const activeChips = useMemo(() => {
    const chips: { key: string; label: string; onClear: () => void }[] = []
    if (activeCategory !== 'All') {
      chips.push({ key: 'category', label: activeCategory, onClear: () => onCategoryChange('All') })
    }
    if (selectedColor !== 'All') {
      chips.push({ key: 'color', label: selectedColor, onClear: () => onColorChange('All') })
    }
    if (selectedSize !== 'All') {
      chips.push({ key: 'size', label: `Size ${selectedSize}`, onClear: () => onSizeChange('All') })
    }
    if (priceRangeActive) {
      chips.push({
        key: 'price',
        label: `${formatMobileBdt(drawerMin)} – ${formatMobileBdt(drawerMax)}`,
        onClear: () => onPriceRangeChange(null, null),
      })
    }
    if (sortBy !== 'Default') {
      chips.push({
        key: 'sort',
        label: mobileSort,
        onClear: () => onSortChange('Default'),
      })
    }
    return chips
  }, [
    activeCategory,
    drawerMax,
    drawerMin,
    mobileSort,
    onCategoryChange,
    onColorChange,
    onPriceRangeChange,
    onSizeChange,
    onSortChange,
    priceRangeActive,
    selectedColor,
    selectedSize,
    sortBy,
  ])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.body.dataset.filterOpen = 'true'

    const raf = requestAnimationFrame(() => {
      const focusable = drawerRef.current?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )
      focusable?.focus()
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
      document.body.style.overflow = prev
      delete document.body.dataset.filterOpen
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    const next = new Set<FilterSectionId>()
    if (activeCategory !== 'All') next.add('category')
    if (selectedColor !== 'All') next.add('color')
    if (selectedSize !== 'All') next.add('size')
    if (priceRangeActive) next.add('price')
    if (sortBy !== 'Default') next.add('sort')
    if (!next.size) next.add('category')
    setExpandedSections(next)
  }, [open, activeCategory, selectedColor, selectedSize, priceRangeActive, sortBy])

  useEffect(() => {
    if (!sizeMeta.enabled && selectedSize !== 'All') onSizeChange('All')
  }, [sizeMeta.enabled, selectedSize, onSizeChange])

  const toggleSection = (id: FilterSectionId) => {
    setExpandedSections((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleCategoryChange = (category: Category) => {
    onCategoryChange(category)
    onSizeChange('All')
  }

  const sectionSummary = (id: FilterSectionId) => {
    if (id === 'category' && activeCategory !== 'All') return activeCategory
    if (id === 'color' && selectedColor !== 'All') return selectedColor
    if (id === 'size' && selectedSize !== 'All') return selectedSize
    if (id === 'price' && priceRangeActive) {
      return `${formatMobileBdt(drawerMin)} – ${formatMobileBdt(drawerMax)}`
    }
    if (id === 'sort' && sortBy !== 'Default') return mobileSort
    return undefined
  }

  const drawerTransition = reduceMotion
    ? { duration: 0 }
    : { type: 'spring' as const, stiffness: 280, damping: 30, mass: 0.88 }

  const fadeTransition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.34, ease: DRAWER_EASE }

  const handleDrawerTouchStart = (event: TouchEvent) => {
    touchStartX.current = event.touches[0]?.clientX ?? 0
  }

  const handleDrawerTouchEnd = (event: TouchEvent) => {
    const endX = event.changedTouches[0]?.clientX ?? 0
    if (touchStartX.current - endX > 72) onClose()
  }

  const applyLabel =
    resultCount === 0
      ? 'No matching items'
      : `Show ${resultCount} result${resultCount === 1 ? '' : 's'}`

  const panel = (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            className="mobile-filter-drawer__backdrop"
            aria-label="Close filters"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={fadeTransition}
            onClick={onClose}
          />

          <motion.aside
            ref={drawerRef}
            className="mobile-filter-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Product filters"
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={drawerTransition}
            onTouchStart={handleDrawerTouchStart}
            onTouchEnd={handleDrawerTouchEnd}
          >
            <div className="mobile-filter-drawer__surface">
              <div className="mobile-filter-drawer__sheen" aria-hidden />
              <div className="mobile-filter-drawer__sweep" aria-hidden />
              <header className="mobile-filter-drawer__header">
                <div className="mobile-filter-drawer__header-main">
                  <div className="mobile-filter-drawer__header-copy">
                    <p className="mobile-filter-drawer__eyebrow">Refine collection</p>
                    <div className="mobile-filter-drawer__title-row">
                      <h2 className="mobile-filter-drawer__title">Filters</h2>
                      {activeCount > 0 ? (
                        <span className="mobile-filter-drawer__count-badge">{activeCount}</span>
                      ) : null}
                    </div>
                    <p className="mobile-filter-drawer__meta">
                      {activeCount > 0
                        ? `${activeCount} active · ${resultCount} product${resultCount === 1 ? '' : 's'}`
                        : `${resultCount} product${resultCount === 1 ? '' : 's'} available`}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="mobile-filter-drawer__close"
                    onClick={onClose}
                    aria-label="Close filters"
                  >
                    <X className="h-4 w-4" strokeWidth={2.2} />
                  </button>
                </div>

                {activeChips.length > 0 ? (
                  <div className="mobile-filter-drawer__active-chips" data-lenis-prevent>
                    {activeChips.map((chip) => (
                      <button
                        key={chip.key}
                        type="button"
                        className="mobile-filter-drawer__active-chip"
                        onClick={chip.onClear}
                      >
                        <span>{chip.label}</span>
                        <X className="h-3 w-3" strokeWidth={2.4} />
                      </button>
                    ))}
                  </div>
                ) : null}
              </header>

              <div className="mobile-filter-drawer__body" data-lenis-prevent>
                <AccordionSection
                  id="category"
                  title="Category"
                  summary={sectionSummary('category')}
                  hasSelection={activeCategory !== 'All'}
                  expanded={expandedSections.has('category')}
                  onToggle={toggleSection}
                >
                  <div className="mobile-filter-drawer__chips">
                    {categories.map((category) => {
                      const selected = activeCategory === category
                      return (
                        <button
                          key={category}
                          type="button"
                          className={cn(
                            'mobile-filter-drawer__chip',
                            selected && 'mobile-filter-drawer__chip--active',
                          )}
                          onClick={() => handleCategoryChange(category)}
                          aria-pressed={selected}
                        >
                          {category}
                          {selected ? <Check className="mobile-filter-drawer__chip-check" strokeWidth={2.5} /> : null}
                        </button>
                      )
                    })}
                  </div>
                </AccordionSection>

                <AccordionSection
                  id="color"
                  title="Color"
                  summary={sectionSummary('color')}
                  hasSelection={selectedColor !== 'All'}
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
                                <span className="mobile-filter-drawer__color-swatch-check" aria-hidden>
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
                </AccordionSection>

                <AccordionSection
                  id="size"
                  title="Size"
                  hint={
                    sizeMeta.enabled
                      ? sizeMeta.hint
                      : 'Select a category first to see the right sizes.'
                  }
                  summary={sectionSummary('size')}
                  hasSelection={selectedSize !== 'All'}
                  expanded={expandedSections.has('size')}
                  onToggle={toggleSection}
                >
                  {sizeMeta.enabled ? (
                    <div
                      className={cn(
                        'mobile-filter-drawer__size-grid',
                        sizeMeta.hint.includes('Shoe') && 'mobile-filter-drawer__size-grid--footwear',
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
                </AccordionSection>

                <AccordionSection
                  id="price"
                  title="Price"
                  summary={sectionSummary('price')}
                  hasSelection={priceRangeActive}
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
                </AccordionSection>

                <AccordionSection
                  id="sort"
                  title="Sort by"
                  summary={sectionSummary('sort')}
                  hasSelection={sortBy !== 'Default'}
                  expanded={expandedSections.has('sort')}
                  onToggle={toggleSection}
                >
                  <div className="mobile-filter-drawer__list">
                    {mobileSortOptions.map((option) => {
                      const selected = mobileSort === option
                      return (
                        <button
                          key={option}
                          type="button"
                          className={cn(
                            'mobile-filter-drawer__row',
                            selected && 'mobile-filter-drawer__row--active',
                          )}
                          onClick={() => onSortChange(catalogSortFromMobile(option as MobileSortOption))}
                          aria-pressed={selected}
                        >
                          <span>{option}</span>
                          <span
                            className={cn(
                              'mobile-filter-drawer__radio',
                              selected && 'mobile-filter-drawer__radio--active',
                            )}
                          >
                            {selected ? <Check className="h-3 w-3" strokeWidth={2.8} /> : null}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </AccordionSection>
              </div>

              <footer className="mobile-filter-drawer__footer">
                <button
                  type="button"
                  className="mobile-filter-drawer__clear"
                  onClick={onClear}
                  disabled={activeCount === 0}
                >
                  Reset
                </button>
                <button
                  type="button"
                  className={cn(
                    'mobile-filter-drawer__apply',
                    resultCount === 0 && 'mobile-filter-drawer__apply--empty',
                  )}
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
