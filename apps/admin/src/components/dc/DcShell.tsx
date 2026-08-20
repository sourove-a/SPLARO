'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'

import type { AdminNavGroup } from '@/lib/navigation/admin-nav'

import { DcHeader, type DcHeaderProps } from './DcHeader'
import { DcIcon } from './DcIcon'
import { DcMobileAppChrome } from './DcMobileAppChrome'
import { DcRail, type DcRailProps } from './DcRail'
import { DcSidebar, type DcSidebarUser } from './DcSidebar'

const SIDEBAR_KEY = 'splaro-admin-sidebar-collapsed'
const RAIL_KEY = 'splaro-admin-rail-open'

function readFlag(key: string, fallback: boolean) {
  if (typeof window === 'undefined') return fallback
  try {
    const v = window.localStorage.getItem(key)
    return v === null ? fallback : v === '1'
  } catch {
    return fallback
  }
}

function writeFlag(key: string, value: boolean) {
  try {
    window.localStorage.setItem(key, value ? '1' : '0')
  } catch {
    // Storage is best-effort; the shell still works without persistence.
  }
}

export interface DcShellProps {
  groups: AdminNavGroup[]
  activeHref: string
  user: DcSidebarUser
  onSignOut?: () => void
  onOpenProfile?: () => void
  header: Omit<DcHeaderProps, 'railOpen' | 'onToggleRail'>
  rail?: DcRailProps
  /** Rendered between the header and the page body — e.g. the Telegram banner. */
  banner?: ReactNode
  /** Sticky page-head bar. */
  pageHead?: ReactNode
  onAskSplaro?: () => void
  children: ReactNode
}

export function DcShell({
  groups,
  activeHref,
  user,
  onSignOut,
  onOpenProfile,
  header,
  rail,
  banner,
  pageHead,
  onAskSplaro,
  children,
}: DcShellProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [railOpen, setRailOpen] = useState(true)
  const [compactViewport, setCompactViewport] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  // Persisted layout preferences are read after mount so SSR and the first
  // client render agree.
  useEffect(() => {
    setCollapsed(readFlag(SIDEBAR_KEY, false))
    setRailOpen(readFlag(RAIL_KEY, true))
  }, [])

  useEffect(() => {
    const query = window.matchMedia('(max-width: 820px)')
    const sync = () => {
      setCompactViewport(query.matches)
      if (!query.matches) setMobileNavOpen(false)
    }
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    if (compactViewport) setMobileNavOpen(false)
  }, [activeHref, compactViewport])

  useEffect(() => {
    if (!compactViewport || !mobileNavOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [compactViewport, mobileNavOpen])

  useEffect(() => {
    if (!mobileNavOpen) return
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileNavOpen(false)
    }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [mobileNavOpen])

  const toggleCollapsed = useCallback(() => {
    if (compactViewport) {
      setMobileNavOpen((open) => !open)
      return
    }
    setCollapsed((c) => {
      writeFlag(SIDEBAR_KEY, !c)
      return !c
    })
  }, [compactViewport])

  const toggleRail = useCallback(() => {
    setRailOpen((r) => {
      writeFlag(RAIL_KEY, !r)
      return !r
    })
  }, [])

  const mobileTitle = useMemo(() => {
    if (activeHref === '/dashboard') return 'Today'
    if (activeHref === '/dashboard/packing-station') return 'Pack'
    if (activeHref.startsWith('/dashboard/orders/')) {
      const seg = activeHref.replace('/dashboard/orders/', '').replace('/detail', '')
      return seg && seg !== 'new' ? `Order #${seg}` : 'New order'
    }
    if (activeHref.startsWith('/dashboard/products/')) {
      const seg = activeHref.replace('/dashboard/products/', '').replace('/edit', '')
      return seg && seg !== 'new' ? 'Edit product' : 'New product'
    }
    if (activeHref.startsWith('/dashboard/customers/')) return 'Customer 360'
    const exact = groups.flatMap((group) => group.items).find((item) => item.href === activeHref)
    if (exact) return exact.label
    const prefixMatch = groups
      .flatMap((group) => group.items)
      .find((item) => item.href !== '/dashboard' && activeHref.startsWith(item.href))
    if (prefixMatch) return prefixMatch.label
    return 'SPLARO'
  }, [activeHref, groups])

  return (
    <div
      className="dc-root dc-ambient"
      data-compact={compactViewport ? 'true' : 'false'}
      data-mobile-nav-open={compactViewport && mobileNavOpen ? 'true' : 'false'}
      style={{ minHeight: '100vh', display: 'flex' }}
    >
      <DcSidebar
        groups={groups}
        activeHref={activeHref}
        collapsed={compactViewport ? false : collapsed}
        onToggleCollapsed={toggleCollapsed}
        user={user}
        onSignOut={onSignOut}
        onOpenProfile={onOpenProfile}
      />
      {compactViewport && mobileNavOpen ? (
        <button
          type="button"
          className="dc-mobile-nav-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobileNavOpen(false)}
        />
      ) : null}

      <div className="dc-shell-main" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {compactViewport ? (
          <DcMobileAppChrome
            title={mobileTitle}
            activeHref={activeHref}
            apiLabel={header.apiLabel}
            apiTone={header.apiTone}
            navOpen={mobileNavOpen}
            onToggleNav={toggleCollapsed}
            {...(header.onlineLabel ? { onlineLabel: header.onlineLabel } : {})}
            {...(header.notifications !== undefined ? { notifications: header.notifications } : {})}
            {...(header.notificationsUrgent !== undefined ? { notificationsUrgent: header.notificationsUrgent } : {})}
            {...(header.onOpenPalette ? { onOpenSearch: header.onOpenPalette } : {})}
            {...(header.onOpenNotifications ? { onOpenNotifications: header.onOpenNotifications } : {})}
            {...(header.onOpenConnection ? { onOpenConnection: header.onOpenConnection } : {})}
            {...(onAskSplaro ? { onAskSplaro } : {})}
          />
        ) : null}
        {!compactViewport ? <DcHeader {...header} railOpen={railOpen} onToggleRail={toggleRail} /> : null}
        {banner}

        <div className="dc-main-row" style={{ flex: 1, display: 'flex', minWidth: 0 }}>
          <main
            className="dc-page-body"
            style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}
          >
            {pageHead}
            {/* Page slot must stay unwrapped — Next loading.tsx is a Suspense
                boundary. An extra div here or in the Server layout hydrates as
                Suspense vs div. */}
            {children}
          </main>

          {!compactViewport && railOpen && rail ? <DcRail {...rail} /> : null}
        </div>
      </div>

      {onAskSplaro ? (
        <button
          type="button"
          className="dc-ask-splaro"
          onClick={onAskSplaro}
          aria-label="Ask SPLARO"
          title="Ask SPLARO"
        >
          <DcIcon name="icon-sparkles" size={18} />
        </button>
      ) : null}
    </div>
  )
}
