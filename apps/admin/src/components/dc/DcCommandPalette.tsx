'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'

import { DcIcon } from './DcIcon'
import { FONT, MONO } from './tokens'
import type { CommandNavItem } from '@/lib/navigation/admin-nav'

export interface DcCommandPaletteProps {
  open: boolean
  onClose: () => void
  items: CommandNavItem[]
}

/** ⌘K palette over every admin route. */
export function DcCommandPalette({ open, onClose, items }: DcCommandPaletteProps) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setCursor(0)
      // Autofocus has to wait for the dialog to actually be in the DOM.
      window.setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    const pool = q
      ? items.filter(
          (i) =>
            i.label.toLowerCase().includes(q) ||
            i.group.toLowerCase().includes(q) ||
            (i.description ?? '').toLowerCase().includes(q),
        )
      : items
    return pool.slice(0, 40)
  }, [items, query])

  useEffect(() => {
    setCursor(0)
  }, [query])

  if (!open) return null

  const go = (item: CommandNavItem | undefined) => {
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
            placeholder="Search orders, products, customers…"
            aria-label="Search admin"
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
                  key={item.href}
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
          <span style={{ flex: 1 }} />
          <span>{results.length} results</span>
        </div>
      </div>
    </div>
  )
}
