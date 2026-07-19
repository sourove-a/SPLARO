'use client'

import '@/styles/pages/shop.css'

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Check, X } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from '@/lib/motion/react'
import { cn } from '@/lib/utils/cn'
import {
  catalogSortFromMobile,
  getMobileSortOptions,
  mobileSortFromCatalog,
} from '@/lib/shop/filter-config'
import { type CatalogSortOption, type MobileSortOption } from '@/lib/shop/mobile-filter'
import { useStorefrontSettings } from '@/components/providers/StorefrontSettingsProvider'
import { useOverlayScrollLock } from '@/hooks/useOverlayScrollLock'

const EASE = [0.22, 1, 0.36, 1] as const

interface MobileSortSheetProps {
  open: boolean
  sortBy: CatalogSortOption
  onClose: () => void
  onSortChange: (value: CatalogSortOption) => void
}

export function MobileSortSheet({ open, sortBy, onClose, onSortChange }: MobileSortSheetProps) {
  const { config } = useStorefrontSettings()
  const shopFilters = config.shopFilters!
  const options = getMobileSortOptions(shopFilters)
  const selected = mobileSortFromCatalog(sortBy, shopFilters)
  const reduceMotion = useReducedMotion()
  const sheetRef = useRef<HTMLElement>(null)
  useOverlayScrollLock(open)

  useEffect(() => {
    if (!open) return
    const restoreTarget =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    document.body.dataset.filterOpen = 'true'

    const raf = requestAnimationFrame(() => {
      sheetRef.current
        ?.querySelector<HTMLElement>('button[aria-selected="true"], button')
        ?.focus()
    })

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)

    return () => {
      cancelAnimationFrame(raf)
      delete document.body.dataset.filterOpen
      document.removeEventListener('keydown', onKey)
      restoreTarget?.focus({ preventScroll: true })
    }
  }, [open, onClose])

  const fade = reduceMotion ? { duration: 0 } : { duration: 0.28, ease: EASE }
  const slide = reduceMotion
    ? { duration: 0 }
    : { type: 'spring' as const, stiffness: 420, damping: 38, mass: 0.75 }

  const panel = (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            className="shop-filter-sheet__backdrop"
            aria-label="Close sort"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={fade}
            onClick={onClose}
          />
          <motion.aside
            ref={sheetRef}
            className="shop-filter-sheet shop-mobile-sort-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Sort products"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={slide}
          >
            <div className="shop-filter-sheet__handle" aria-hidden />
            <header className="shop-filter-sheet__header">
              <h2 className="shop-filter-sheet__title">Sort</h2>
              <button
                type="button"
                className="shop-filter-sheet__close"
                onClick={onClose}
                aria-label="Close sort"
              >
                <X className="h-4 w-4" strokeWidth={2.2} />
              </button>
            </header>
            <div className="shop-filter-sheet__body shop-mobile-sort-sheet__body" data-lenis-prevent>
              <div className="shop-mobile-sort-sheet__list" role="listbox" aria-label="Sort options">
                {options.map((option) => {
                  const isSelected = selected === option
                  return (
                    <button
                      key={option}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      className={cn(
                        'shop-mobile-sort-sheet__option',
                        isSelected && 'shop-mobile-sort-sheet__option--active',
                      )}
                      onClick={() => {
                        onSortChange(catalogSortFromMobile(option as MobileSortOption, shopFilters))
                        onClose()
                      }}
                    >
                      <span>{option}</span>
                      <span
                        className={cn(
                          'shop-mobile-sort-sheet__radio',
                          isSelected && 'shop-mobile-sort-sheet__radio--active',
                        )}
                        aria-hidden
                      >
                        {isSelected ? <Check className="h-3 w-3" strokeWidth={2.8} /> : null}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  )

  if (typeof document === 'undefined') return null
  return createPortal(panel, document.body)
}
