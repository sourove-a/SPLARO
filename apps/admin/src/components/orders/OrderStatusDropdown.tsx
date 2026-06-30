'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

export type OrderUiStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'packed'
  | 'shipped'
  | 'delivered'
  | 'cancelled'

const STATUS_OPTIONS: { ui: OrderUiStatus; api: string; label: string }[] = [
  { ui: 'pending', api: 'PENDING', label: 'Pending' },
  { ui: 'confirmed', api: 'CONFIRMED', label: 'Confirmed' },
  { ui: 'processing', api: 'PROCESSING', label: 'Processing' },
  { ui: 'packed', api: 'PACKED', label: 'Packed' },
  { ui: 'shipped', api: 'SHIPPED', label: 'Shipped' },
  { ui: 'delivered', api: 'DELIVERED', label: 'Delivered' },
  { ui: 'cancelled', api: 'CANCELLED', label: 'Cancelled' },
]

const STATUS_CLASS: Record<OrderUiStatus, string> = {
  pending: 'admin-status admin-status--pending',
  confirmed: 'admin-status admin-status--processing',
  processing: 'admin-status admin-status--processing',
  packed: 'admin-status admin-status--shipped',
  shipped: 'admin-status admin-status--shipped',
  delivered: 'admin-status admin-status--delivered',
  cancelled: 'admin-status admin-status--cancelled',
}

interface OrderStatusDropdownProps {
  status: OrderUiStatus
  disabled?: boolean
  loading?: boolean
  onSelect: (apiStatus: string, label: string) => void
}

export function OrderStatusDropdown({ status, disabled, loading, onSelect }: OrderStatusDropdownProps) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0, openUp: false })
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => setMounted(true), [])

  const close = useCallback(() => setOpen(false), [])

  const updatePosition = useCallback(() => {
    if (!btnRef.current) return
    const rect = btnRef.current.getBoundingClientRect()
    const menuHeight = menuRef.current?.offsetHeight ?? 280
    const spaceBelow = window.innerHeight - rect.bottom
    const openUp = spaceBelow < menuHeight + 16
    setPos({
      top: openUp ? Math.max(8, rect.top - menuHeight - 6) : rect.bottom + 6,
      left: Math.max(8, rect.left),
      openUp,
    })
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    updatePosition()
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)
    return () => {
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [open, updatePosition])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, close])

  const current = STATUS_OPTIONS.find((o) => o.ui === status) ?? STATUS_OPTIONS[0]!

  const handleSelect = (option: (typeof STATUS_OPTIONS)[number]) => {
    if (option.ui === status) {
      close()
      return
    }
    if (option.api === 'CANCELLED' && status !== 'cancelled') {
      if (!window.confirm('Cancel this order?')) return
    }
    close()
    onSelect(option.api, option.label)
  }

  const menu =
    open && mounted
      ? createPortal(
          <>
            <button
              type="button"
              className="fixed inset-0 z-[310] cursor-default bg-transparent"
              onClick={close}
              aria-label="Close status menu"
            />
            <div
              ref={menuRef}
              role="menu"
              aria-label="Order status"
              className="order-status-dropdown fixed z-[320] min-w-[168px] overflow-hidden rounded-[12px] border border-black/8 bg-white py-1 shadow-[0_18px_50px_rgba(17,17,20,0.16)] dark:border-white/10 dark:bg-[#1c1c24] dark:shadow-[0_18px_50px_rgba(0,0,0,0.45)]"
              style={{ top: pos.top, left: pos.left }}
            >
              {STATUS_OPTIONS.map((option) => {
                const active = option.ui === status
                return (
                  <button
                    key={option.api}
                    type="button"
                    role="menuitem"
                    className={cn(
                      'order-status-dropdown__item flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold transition',
                      active
                        ? 'bg-black/5 text-[var(--admin-text-primary)] dark:bg-white/8'
                        : 'text-[var(--admin-text-secondary)] hover:bg-black/5 dark:hover:bg-white/6',
                      option.ui === 'cancelled' && !active && 'text-red-600 dark:text-red-400',
                    )}
                    onClick={() => handleSelect(option)}
                  >
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                      {active ? <Check className="h-3.5 w-3.5" aria-hidden /> : null}
                    </span>
                    <span>{option.label}</span>
                  </button>
                )
              })}
            </div>
          </>,
          document.body,
        )
      : null

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled || loading}
        className={cn(
          STATUS_CLASS[status],
          'cursor-pointer gap-1 capitalize disabled:cursor-wait disabled:opacity-60',
        )}
        onClick={(e) => {
          e.stopPropagation()
          if (disabled || loading) return
          setOpen((v) => !v)
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Change order status"
      >
        {current.label}
        <ChevronDown className={cn('h-3 w-3 opacity-70 transition', open && 'rotate-180')} aria-hidden />
      </button>
      {menu}
    </>
  )
}
