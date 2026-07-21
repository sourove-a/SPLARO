'use client'

import '@/styles/pages/shop.css'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from '@/lib/motion/react'
import { Check, ChevronDown, X } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { pluralize } from '@/lib/utils/pluralize'
import { HorizontalScrollRail } from '@/components/ui/HorizontalScrollRail'
import { formatMobileBdt, isMobilePriceRangeActive } from '@/lib/shop/mobile-filter'
import { getEnabledMobilePriceChips } from '@/lib/shop/filter-config'
import { useStorefrontSettings } from '@/components/providers/StorefrontSettingsProvider'
import { getShopSizeSectionMeta, type Category } from '@/data/storefront'
import { useOverlayScrollLock } from '@/hooks/useOverlayScrollLock'
import { MICRO, SETTLE } from '@/lib/motion/config'

type FilterSectionId = 'color' | 'size' | 'price'

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
  onColorChange: (value: string) => void
  onSizeChange: (value: string) => void
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
            transition={MICRO}
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
  activeCategory,
  colorOptions,
  sizeOptions,
  selectedColor,
  selectedSize,
  priceBounds,
  priceMin,
  priceMax,
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
  useOverlayScrollLock(open)
  const sizeMeta = useMemo(() => getShopSizeSectionMeta(activeCategory), [activeCategory])
  const [expandedSections, setExpandedSections] = useState<Set<FilterSectionId>>(
    () => new Set(['color']),
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

  const activeChips = useMemo(() => {
    const chips: { key: string; label: string; onClear: () => void }[] = []
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
    return chips
  }, [
    drawerMax,
    drawerMin,
    onColorChange,
    onPriceRangeChange,
    onSizeChange,
    priceRangeActive,
    selectedColor,
    selectedSize,
  ])

  useEffect(() => {
    if (!open) return
    const restoreTarget =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
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
      delete document.body.dataset.filterOpen
      document.removeEventListener('keydown', onKey)
      restoreTarget?.focus({ preventScroll: true })
    }
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    const next = new Set<FilterSectionId>()
    if (selectedColor !== 'All') next.add('color')
    if (selectedSize !== 'All') next.add('size')
    if (priceRangeActive) next.add('price')
    if (!next.size) {
      if (shopFilters.showColorFilter) next.add('color')
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
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const sectionSummary = (id: FilterSectionId) => {
    if (id === 'color' && selectedColor !== 'All') return selectedColor
    if (id === 'size' && selectedSize !== 'All') return selectedSize
    if (id === 'price' && priceRangeActive) {
      return `${formatMobileBdt(drawerMin)} – ${formatMobileBdt(drawerMax)}`
    }
    return undefined
  }

  const drawerTransition = reduceMotion
    ? { duration: 0 }
    : { type: 'spring' as const, stiffness: 380, damping: 36, mass: 0.78 }

  const fadeTransition = reduceMotion
    ? { duration: 0 }
    : SETTLE

  const applyLabel =
    resultCount === 0 ? 'No matching items' : `Show ${pluralize(resultCount, 'result')}`

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
            aria-label="Filter products"
            initial={{ x: '-105%', opacity: 0.72 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '-105%', opacity: 0.72 }}
            transition={drawerTransition}
          >
            <div className="mobile-filter-drawer__surface">
              <div className="mobile-filter-drawer__edge" aria-hidden />
              <div className="mobile-filter-drawer__sheen" aria-hidden />
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
                        ? `${activeCount} active · ${activeCategory} · ${resultCount}`
                        : `${activeCategory} · ${resultCount} available`}
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
                  <HorizontalScrollRail
                    className="mobile-filter-drawer__chips-rail"
                    trackClassName="mobile-filter-drawer__active-chips"
                    variant="pill"
                    ariaLabel="Active filters"
                  >
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
                  </HorizontalScrollRail>
                ) : null}
              </header>

              <div className="mobile-filter-drawer__body" data-lenis-prevent>
                {shopFilters.showColorFilter ? (
                <AccordionSection
                  id="color"
                  title={shopFilters.labels.color}
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
                ) : null}

                {shopFilters.showSizeFilter ? (
                <AccordionSection
                  id="size"
                  title={shopFilters.labels.size}
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
                ) : null}

                {shopFilters.showPriceFilter ? (
                <AccordionSection
                  id="price"
                  title={shopFilters.labels.price}
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
                ) : null}

              </div>

              <footer className="mobile-filter-drawer__footer">
                <button
                  type="button"
                  className="mobile-filter-drawer__clear"
                  onClick={onClear}
                  disabled={activeCount === 0}
                >
                  Clear all
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
