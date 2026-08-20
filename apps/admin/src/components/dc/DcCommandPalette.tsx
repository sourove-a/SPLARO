'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'

import { DcIcon } from './DcIcon'
import { FONT, MONO } from './tokens'
import type { CommandNavItem } from '@/lib/navigation/admin-nav'
import { GOTO_TARGETS, type RecentPage } from '@/lib/navigation/keyboard-nav'
import { fetchCustomers } from '@/lib/api/customers'
import { fetchOrders } from '@/lib/api/orders'
import { fetchProducts } from '@/lib/api/products'

export interface DcCommandPaletteProps {
  open: boolean
  onClose: () => void
  items: CommandNavItem[]
  /** Last pages visited this session — shown before anything is typed. */
  recent?: RecentPage[]
}

/** A palette row: a nav route, a recent page, or a record from the catalog. */
interface PaletteRow {
  key: string
  href: string
  label: string
  description?: string | undefined
  icon: string
  group: string
}

/** Entity lookups start here — below this a query is still being typed. */
const ENTITY_MIN_CHARS = 2
const ENTITY_DEBOUNCE_MS = 220

/** ⌘K palette over every admin route. */
export function DcCommandPalette({ open, onClose, items, recent = [] }: DcCommandPaletteProps) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const [entityRows, setEntityRows] = useState<PaletteRow[]>([])
  const [entityLoading, setEntityLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setCursor(0)
      // Autofocus has to wait for the dialog to actually be in the DOM.
      window.setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  /**
   * Records, not just routes.
   *
   * The palette used to index navigation only, so looking up SPL-1042 meant
   * opening Orders and searching again. Orders, products and customers are
   * queried in parallel, debounced, and every response is dropped unless it is
   * still the current query — otherwise a slow request for an earlier query
   * lands on top of the results for what was typed after it.
   */
  useEffect(() => {
    const q = query.trim()
    if (!open || q.length < ENTITY_MIN_CHARS) {
      setEntityRows([])
      setEntityLoading(false)
      return
    }

    let live = true
    setEntityLoading(true)
    const timer = window.setTimeout(() => {
      void Promise.allSettled([
        fetchOrders({ search: q, limit: 4 }),
        fetchProducts({ search: q, limit: 4 }),
        fetchCustomers({ search: q, limit: 4 }),
      ]).then(([orders, products, customers]) => {
        if (!live) return
        const rows: PaletteRow[] = []

        if (orders.status === 'fulfilled') {
          for (const order of orders.value.orders ?? []) {
            rows.push({
              key: `order-${order.id}`,
              href: `/dashboard/orders/${order.invoiceNumber ?? order.id}`,
              label: order.invoiceNumber ?? order.id,
              description: [order.shippingName, order.status].filter(Boolean).join(' · '),
              icon: 'icon-shopping-bag',
              group: 'Orders',
            })
          }
        }
        if (products.status === 'fulfilled') {
          for (const product of products.value.products ?? []) {
            rows.push({
              key: `product-${product.id}`,
              href: `/dashboard/products/${product.id}/edit`,
              label: product.name,
              description: product.sku ?? product.category?.name ?? undefined,
              icon: 'icon-package',
              group: 'Products',
            })
          }
        }
        if (customers.status === 'fulfilled') {
          for (const customer of customers.value.customers ?? []) {
            const name = [customer.firstName, customer.lastName].filter(Boolean).join(' ').trim()
            rows.push({
              key: `customer-${customer.id}`,
              href: `/dashboard/customers/${customer.id}`,
              label: name || customer.phone || customer.email || 'Customer',
              description: customer.phone ?? customer.email ?? undefined,
              icon: 'icon-users',
              group: 'Customers',
            })
          }
        }

        setEntityRows(rows)
        setEntityLoading(false)
      })
    }, ENTITY_DEBOUNCE_MS)

    return () => {
      live = false
      window.clearTimeout(timer)
    }
  }, [open, query])

  const results = useMemo((): PaletteRow[] => {
    const q = query.trim().toLowerCase()
    const navRows: PaletteRow[] = (
      q
        ? items.filter(
            (i) =>
              i.label.toLowerCase().includes(q) ||
              i.group.toLowerCase().includes(q) ||
              (i.description ?? '').toLowerCase().includes(q),
          )
        : items
    ).map((item) => ({
      key: `nav-${item.href}`,
      href: item.href,
      label: item.label,
      description: item.description,
      icon: item.icon,
      group: item.group,
    }))

    // Nothing typed yet: lead with where this session has already been.
    if (!q) {
      const recentRows: PaletteRow[] = recent.map((page) => ({
        key: `recent-${page.href}`,
        href: page.href,
        label: page.label,
        description: page.href,
        icon: 'icon-history',
        group: 'Recent',
      }))
      return [...recentRows, ...navRows].slice(0, 40)
    }

    // Typed: records first — a query with two-plus characters is usually a
    // record, and routes are one keystroke away with the arrow keys anyway.
    return [...entityRows, ...navRows].slice(0, 40)
  }, [entityRows, items, query, recent])

  useEffect(() => {
    setCursor(0)
  }, [query])

  if (!open) return null

  const go = (item: PaletteRow | undefined) => {
    if (!item) return
    onClose()
    router.push(item.href)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 80,
        background: 'var(--overlay)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '12vh',
        animation: 'dc-fadein .12s ease-out',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose()
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setCursor((c) => Math.min(c + 1, results.length - 1))
          }
          if (e.key === 'ArrowUp') {
            e.preventDefault()
            setCursor((c) => Math.max(c - 1, 0))
          }
          if (e.key === 'Enter') {
            e.preventDefault()
            go(results[cursor])
          }
        }}
        style={{
          width: 'min(620px, 92vw)',
          maxHeight: '66vh',
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid var(--line-2)',
          borderRadius: 14,
          background: 'var(--surface)',
          backgroundImage: 'var(--card-sheen)',
          overflow: 'hidden',
          animation: 'dc-rise .14s ease-out',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '13px 15px',
            borderBottom: '1px solid var(--line)',
          }}
        >
          <DcIcon name="icon-search" size={16} color="var(--ink-3)" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search screens, orders, products, customers…"
            aria-label="Search admin"
            // Same autofill guard as the sidebar filter — the password manager
            // otherwise injects the saved admin email the moment this focuses.
            type="search"
            name="dc-command-query"
            className="dc-nav-filter"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            data-1p-ignore
            data-lpignore="true"
            data-form-type="other"
            style={{
              flex: 1,
              border: 0,
              background: 'transparent',
              outline: 'none',
              color: 'var(--ink)',
              font: `400 14px/1 ${FONT}`,
            }}
          />
          <span
            style={{
              padding: '2px 6px',
              borderRadius: 5,
              border: '1px solid var(--line)',
              font: `600 10.5px/1.4 ${MONO}`,
              color: 'var(--ink-3)',
            }}
          >
            ESC
          </span>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 6 }}>
          {results.length === 0 ? (
            <div
              style={{
                padding: '38px 16px',
                textAlign: 'center',
                font: `400 13px/1.5 ${FONT}`,
                color: 'var(--ink-3)',
              }}
            >
              Nothing matches “{query}”.
            </div>
          ) : (
            results.map((item, i) => {
              const on = i === cursor
              return (
                <button
                  key={item.key}
                  type="button"
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => go(item)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 11,
                    width: '100%',
                    padding: '9px 10px',
                    border: 0,
                    borderRadius: 9,
                    cursor: 'pointer',
                    textAlign: 'left',
                    background: on ? 'var(--violet-soft)' : 'transparent',
                  }}
                >
                  <span
                    style={{
                      display: 'grid',
                      placeItems: 'center',
                      width: 26,
                      height: 26,
                      flex: 'none',
                      borderRadius: 7,
                      border: '1px solid var(--line)',
                      background: 'var(--surface-2)',
                      color: on ? 'var(--violet)' : 'var(--ink-3)',
                    }}
                  >
                    <DcIcon name={item.icon} size={13} />
                  </span>
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 3,
                    }}
                  >
                    <span
                      style={{
                        font: `500 13px/1.3 ${FONT}`,
                        color: on ? 'var(--violet)' : 'var(--ink)',
                      }}
                    >
                      {item.label}
                    </span>
                    {item.description ? (
                      <span
                        style={{
                          font: `400 11.5px/1.35 ${FONT}`,
                          color: 'var(--ink-3)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {item.description}
                      </span>
                    ) : null}
                  </span>
                  <span
                    style={{
                      flex: 'none',
                      font: `500 10.5px/1 ${FONT}`,
                      letterSpacing: '.08em',
                      textTransform: 'uppercase',
                      color: 'var(--ink-3)',
                    }}
                  >
                    {item.group}
                  </span>
                </button>
              )
            })
          )}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: '9px 15px',
            borderTop: '1px solid var(--line)',
            font: `500 11px/1 ${FONT}`,
            color: 'var(--ink-3)',
          }}
        >
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span title="Press g then the key">
            g{' '}
            {Object.entries(GOTO_TARGETS)
              .map(([key]) => key)
              .join(' / ')}
          </span>
          <span style={{ flex: 1 }} />
          <span>{entityLoading ? 'searching…' : `${results.length} results`}</span>
        </div>
      </div>
    </div>
  )
}
