'use client'

import '@/styles/pages/shop.css'

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown } from 'lucide-react'
import { AnimatePresence, m, useReducedMotion } from '@/lib/motion/react'
import { cn } from '@/lib/utils/cn'

import { SETTLE } from '@/lib/motion/config'

interface ShopFilterDropdownProps {
  label: string
  panelTitle: string
  value: string
  options: readonly string[]
  open: boolean
  onToggle: () => void
  onClose: () => void
  onChange: (value: string) => void
  labelVariant?: 'default' | 'sort'
  sortDisplay?: string
  active?: boolean
}

type PanelPosition = { top: number; left: number; width: number }

function measureAnchor(anchor: HTMLElement | null): PanelPosition | null {
  if (!anchor || typeof window === 'undefined') return null
  const rect = anchor.getBoundingClientRect()
  const width = Math.max(rect.width, 196)
  const maxLeft = Math.max(12, window.innerWidth - width - 12)
  return {
    top: Math.round(rect.bottom + 10),
    left: Math.round(Math.min(Math.max(12, rect.left), maxLeft)),
    width: Math.round(width),
  }
}

function samePosition(a: PanelPosition | null, b: PanelPosition | null): boolean {
  if (!a || !b) return a === b
  return a.top === b.top && a.left === b.left && a.width === b.width
}

export function ShopFilterDropdown({
  label,
  panelTitle,
  value,
  options,
  open,
  onToggle,
  onClose,
  onChange,
  labelVariant = 'default',
  sortDisplay,
  active = false,
}: ShopFilterDropdownProps) {
  const reducedMotion = useReducedMotion()
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const openedAtRef = useRef(0)
  const panelId = useId()
  const isSort = labelVariant === 'sort'
  const resolvedSort = sortDisplay ?? (value === 'Default' ? 'Default' : value)
  const displayValue = value === 'All' ? 'All' : value

  /** Locked before open so first paint is already under the trigger — no jump. */
  const [position, setPosition] = useState<PanelPosition | null>(null)

  const lockPosition = () => {
    const next = measureAnchor(triggerRef.current)
    if (next) setPosition(next)
    return next
  }

  useLayoutEffect(() => {
    if (!open) return

    const update = () => {
      // Ignore Lenis/micro-scroll while the slide-in is settling — avoids jitter
      if (performance.now() - openedAtRef.current < 340) return
      const next = measureAnchor(triggerRef.current)
      if (!next) return
      setPosition((prev) => (samePosition(prev, next) ? prev : next))
    }

    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, { capture: true, passive: true })
    return () => {
      window.removeEventListener('resize', update, true)
      window.removeEventListener('scroll', update, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (rootRef.current?.contains(target)) return
      if (panelRef.current?.contains(target)) return
      onClose()
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown, { passive: true })
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, onClose])

  const handleTriggerClick = () => {
    if (open) {
      onClose()
      return
    }
    openedAtRef.current = performance.now()
    // Measure first, then open — React batches → no empty/jump frame
    lockPosition()
    onToggle()
  }

  /**
   * Soft slide (no scale) — scale + blur was the “kapa” / shake.
   * Over-damped spring ≈ liquid drop without overshoot.
   */
  const slideTransition = reducedMotion
    ? { duration: 0.12 }
    : {
        type: 'spring' as const,
        stiffness: 420,
        damping: 38,
        mass: 0.7,
      }

  const panelMotion = reducedMotion
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
      }
    : {
        initial: { opacity: 0, y: -12 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -8 },
      }

  return (
    <div ref={rootRef} className={cn('shop-filter-dropdown', open && 'shop-filter-dropdown--open')}>
      <button
        ref={triggerRef}
        type="button"
        data-no-press=""
        className={cn(
          'shop-filter-dropdown__trigger shop-filter-dropdown__trigger--glass',
          open && 'shop-filter-dropdown__trigger--open',
          active && 'shop-filter-dropdown__trigger--selected',
        )}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={panelId}
        aria-label={panelTitle}
        onClick={handleTriggerClick}
      >
        {isSort ? (
          <span className="shop-filter-dropdown__trigger-label shop-filter-dropdown__trigger-label--sort">
            <span className="shop-filter-dropdown__trigger-prefix">Sort: </span>
            <span className="shop-filter-dropdown__trigger-value">{resolvedSort}</span>
          </span>
        ) : (
          <span className="shop-filter-dropdown__trigger-label">
            <span className="shop-filter-dropdown__trigger-field">{label}</span>
            <span className="shop-filter-dropdown__trigger-value">{displayValue}</span>
          </span>
        )}
        {active ? <span className="shop-filter-dropdown__active-dot" aria-hidden /> : null}
        <m.span
          className="shop-filter-dropdown__chevron"
          aria-hidden
          animate={{ rotate: open ? 180 : 0 }}
          transition={SETTLE}
        >
          <ChevronDown className="h-3.5 w-3.5" strokeWidth={2.2} />
        </m.span>
      </button>

      {typeof document !== 'undefined'
        ? createPortal(
            <AnimatePresence
              initial={false}
              onExitComplete={() => {
                if (!open) setPosition(null)
              }}
            >
              {open && position ? (
                <m.div
                  key={`${panelId}-panel`}
                  ref={panelRef}
                  id={panelId}
                  role="presentation"
                  className="shop-filter-dropdown__panel shop-filter-dropdown__panel--glass shop-filter-dropdown__panel--portal"
                  data-lenis-prevent
                  style={{
                    position: 'fixed',
                    zIndex: 90,
                    top: position.top,
                    left: position.left,
                    width: position.width,
                    transformOrigin: 'top center',
                  }}
                  initial={panelMotion.initial}
                  animate={panelMotion.animate}
                  exit={panelMotion.exit}
                  transition={slideTransition}
                >
                  <div className="shop-filter-dropdown__panel-head">{panelTitle}</div>
                  <ul className="shop-filter-dropdown__list" role="listbox" aria-label={panelTitle}>
                    {options.map((option) => {
                      const selected = value === option
                      return (
                        <li key={option} role="none">
                          <button
                            type="button"
                            role="option"
                            aria-selected={selected}
                            className={cn(
                              'shop-filter-dropdown__option',
                              selected && 'shop-filter-dropdown__option--active',
                            )}
                            onClick={() => {
                              onChange(option)
                              onClose()
                            }}
                          >
                            <span
                              className={cn(
                                'shop-filter-dropdown__check',
                                selected && 'shop-filter-dropdown__check--active',
                              )}
                              aria-hidden
                            >
                              {selected ? (
                                <Check className="h-2.5 w-2.5" strokeWidth={3} />
                              ) : null}
                            </span>
                            <span className="shop-filter-dropdown__option-label">{option}</span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </m.div>
              ) : null}
            </AnimatePresence>,
            document.body,
          )
        : null}
    </div>
  )
}
