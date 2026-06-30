'use client'

import { useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface ShopFilterDropdownProps {
  label: string
  panelTitle: string
  value: string
  options: readonly string[]
  open: boolean
  onToggle: () => void
  onClose: () => void
  onChange: (value: string) => void
  /** ILYN-style "Sort:" prefix with muted tone */
  labelVariant?: 'default' | 'sort'
  sortDisplay?: string
}

const PANEL_EASE = [0.16, 1, 0.3, 1] as const

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
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const handlePointer = (event: MouseEvent) => {
      const target = event.target as Node
      if (rootRef.current?.contains(target)) return
      onClose()
    }

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('mousedown', handlePointer)
    document.addEventListener('keydown', handleKey)

    return () => {
      document.removeEventListener('mousedown', handlePointer)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open, onClose])

  const isSort = labelVariant === 'sort'
  const resolvedSort = sortDisplay ?? (value === 'Default' ? 'Default' : value)
  const displayLabel =
    !isSort && (value === 'All' || value === 'Default') ? label : !isSort ? value : null

  return (
    <div ref={rootRef} className={cn('shop-filter-dropdown', open && 'shop-filter-dropdown--open')}>
      <button
        type="button"
        className="shop-filter-dropdown__trigger"
        onClick={onToggle}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        {isSort ? (
          <span className="shop-filter-dropdown__trigger-label shop-filter-dropdown__trigger-label--sort">
            <span className="shop-filter-dropdown__trigger-prefix">Sort:</span>
            <span className="shop-filter-dropdown__trigger-value">{resolvedSort}</span>
          </span>
        ) : (
          <span className="shop-filter-dropdown__trigger-label">{displayLabel}</span>
        )}
        <ChevronDown
          className={cn('shop-filter-dropdown__chevron h-3.5 w-3.5', open && 'shop-filter-dropdown__chevron--open')}
          strokeWidth={2.2}
          aria-hidden
        />
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            className="shop-filter-dropdown__panel"
            role="listbox"
            aria-label={panelTitle}
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.22, ease: PANEL_EASE }}
          >
            <ul className="shop-filter-dropdown__list">
              {options.map((option) => {
                const selected = value === option
                return (
                  <li key={option}>
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
                      />
                      <span>{option}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
