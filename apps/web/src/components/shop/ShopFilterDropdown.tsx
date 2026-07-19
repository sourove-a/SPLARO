'use client'

import '@/styles/pages/shop.css'

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown } from 'lucide-react'
import { AnimatePresence, m, useReducedMotion } from '@/lib/motion/react'
import { cn } from '@/lib/utils/cn'

/** Luxury ease — soft settle, no bounce / jump */
const EASE_PREMIUM = [0.16, 1, 0.3, 1] as const
const OPEN_MS = 0.36
const CLOSE_MS = 0.24

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
}: ShopFilterDropdownProps) {
  const reducedMotion = useReducedMotion()
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
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
      const next = measureAnchor(triggerRef.current)
      if (next) setPosition(next)
    }

    // Re-sync if click-time measure missed (rare)
    if (!position) update()

    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [open, position])

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
    // Measure first, then open — React batches → no empty/jump frame
    lockPosition()
    onToggle()
  }

  const panelMotion = reducedMotion
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.12 },
      }
    : {
        // Unfolds from the trigger — soft settle, no teleport / spring thud
        initial: {
          opacity: 0,
          y: -12,
          scaleY: 0.88,
        },
        animate: {
          opacity: 1,
          y: 0,
          scaleY: 1,
        },
        exit: {
          opacity: 0,
          y: -8,
          scaleY: 0.94,
        },
        transition: {
          duration: OPEN_MS,
          ease: EASE_PREMIUM,
          opacity: { duration: OPEN_MS * 0.75, ease: EASE_PREMIUM },
        },
      }

  const exitTransition = reducedMotion
    ? { duration: 0.1 }
    : { duration: CLOSE_MS, ease: EASE_PREMIUM }

  return (
    <div ref={rootRef} className={cn('shop-filter-dropdown', open && 'shop-filter-dropdown--open')}>
      <button
        ref={triggerRef}
        type="button"
        data-no-press=""
        className={cn(
          'shop-filter-dropdown__trigger shop-filter-dropdown__trigger--glass',
          open && 'shop-filter-dropdown__trigger--open',
        )}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={panelId}
        aria-label={panelTitle}
        onClick={handleTriggerClick}
      >
        {isSort ? (
          <span className="shop-filter-dropdown__trigger-label shop-filter-dropdown__trigger-label--sort">
            <span className="shop-filter-dropdown__trigger-prefix">Sort:</span>
            <span className="shop-filter-dropdown__trigger-value">{resolvedSort}</span>
          </span>
        ) : (
          <span className="shop-filter-dropdown__trigger-label">
            <span className="shop-filter-dropdown__trigger-field">{label}</span>
            <span className="shop-filter-dropdown__trigger-value">{displayValue}</span>
          </span>
        )}
        <m.span
          className="shop-filter-dropdown__chevron"
          aria-hidden
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.32, ease: EASE_PREMIUM }}
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
                  exit={{ ...panelMotion.exit, transition: exitTransition }}
                  transition={panelMotion.transition}
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
