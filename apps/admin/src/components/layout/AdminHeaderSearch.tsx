'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Command } from 'cmdk'
import * as Icons from 'lucide-react'
import { ArrowRight, Search } from 'lucide-react'
import { getCommandItems } from '@/lib/navigation/admin-nav'
import { filterCommandItems } from '@/lib/navigation/admin-search'
import { useAdminNavigate } from '@/lib/navigation/client-nav'

function NavIcon({ name }: { name: string }) {
  const Icon = (Icons as unknown as Record<string, Icons.LucideIcon>)[name] ?? Icons.Circle
  return <Icon className="h-4 w-4 shrink-0 text-[var(--admin-text-secondary)]" strokeWidth={1.75} />
}

export function AdminHeaderSearch() {
  const { navigate } = useAdminNavigate()
  const containerRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const commands = useMemo(() => getCommandItems(), [])
  const filtered = useMemo(() => filterCommandItems(commands, query), [commands, query])
  const groups = useMemo(() => [...new Set(filtered.map((item) => item.group))], [filtered])

  const close = useCallback(() => {
    setOpen(false)
    setQuery('')
  }, [])

  const handleSelect = useCallback(
    (href: string) => {
      navigate(href)
      close()
    },
    [close, navigate],
  )

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setOpen(true)
        requestAnimationFrame(() => {
          containerRef.current?.querySelector('input')?.focus()
        })
      }
      if (event.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close])

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        close()
      }
    }

    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [close, open])

  return (
    <div ref={containerRef} className="relative z-[220] flex-1 max-w-lg">
      <Command shouldFilter={false} className="relative">
        <div className={`admin-search ${open ? 'admin-search--open' : ''}`}>
          <Search className="h-3.5 w-3.5 shrink-0 text-[var(--admin-text-secondary)]" strokeWidth={2} />
          <Command.Input
            value={query}
            onValueChange={setQuery}
            onFocus={() => setOpen(true)}
            onClick={() => setOpen(true)}
            placeholder="Search anything in SPLARO…"
            className="min-w-0 flex-1 bg-transparent text-[13px] font-medium text-[var(--admin-text)] outline-none placeholder:text-[var(--admin-text-secondary)]"
          />
          <kbd className="admin-search-kbd ml-auto">⌘K</kbd>
        </div>

        {open ? (
          <Command.List className="admin-header-search-dropdown">
            {query.trim().length < 2 ? (
              <p className="admin-header-search-dropdown__hint">কমপক্ষে ২টা letter লিখুন — orders, products, legal…</p>
            ) : filtered.length === 0 ? (
              <p className="admin-header-search-dropdown__empty">“{query}” এর জন্য কোনো page নেই।</p>
            ) : (
              groups.map((group) => (
                <Command.Group key={group} heading={group} className="admin-header-search-dropdown__group">
                  {filtered
                    .filter((item) => item.group === group)
                    .map((item) => (
                      <Command.Item
                        key={item.href}
                        value={item.href}
                        onSelect={() => handleSelect(item.href)}
                        className="admin-header-search-dropdown__item"
                      >
                        <NavIcon name={item.icon} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold">{item.label}</p>
                          {item.description ? (
                            <p className="truncate text-xs font-medium text-[var(--admin-text-secondary)]">{item.description}</p>
                          ) : null}
                        </div>
                        <ArrowRight className="h-4 w-4 shrink-0 text-[var(--admin-text-muted)]" />
                      </Command.Item>
                    ))}
                </Command.Group>
              ))
            )}
          </Command.List>
        ) : null}
      </Command>
    </div>
  )
}
