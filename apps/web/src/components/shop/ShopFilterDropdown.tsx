'use client'

import { useEffect, useRef } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
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
}: ShopFilterDropdownProps) {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const handleScroll = () => onClose()
    const handlePointer = (event: MouseEvent) => {
      const target = event.target as Node
      if (rootRef.current?.contains(target)) return
      onClose()
    }

    window.addEventListener('scroll', handleScroll, { passive: true, capture: true })
    document.addEventListener('mousedown', handlePointer)

    return () => {
      window.removeEventListener('scroll', handleScroll, true)
      document.removeEventListener('mousedown', handlePointer)
    }
  }, [open, onClose])

  const displayLabel = value === 'All' || value === 'Default' ? label : value

  return (
    <div ref={rootRef} className={cn('shop-filter-dropdown', open && 'shop-filter-dropdown--open')}>
      <button
        type="button"
        className="shop-filter-dropdown__trigger"
        onClick={onToggle}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="shop-filter-dropdown__trigger-label">{displayLabel}</span>
        {open ? (
          <ChevronUp className="h-3.5 w-3.5" strokeWidth={2.2} />
        ) : (
          <ChevronDown className="h-3.5 w-3.5" strokeWidth={2.2} />
        )}
      </button>

      {open ? (
        <div
          className="shop-filter-dropdown__panel"
          role="listbox"
          aria-label={panelTitle}
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
        </div>
      ) : null}
    </div>
  )
}
