'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import * as Icons from 'lucide-react'
import { ChevronDown, ChevronLeft, ChevronRight, Menu, X } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import { SplaroAdminLogo } from '@/components/brand/SplaroAdminLogo'
import { AdminNavLink } from '@/components/layout/AdminNavLink'
import { useAdminConnection } from '@/lib/hooks/use-admin-connection'
import { useAdminSession } from '@/lib/api/hooks'
import { getSidebarNavGroups, type AdminNavGroup, type AdminNavItem } from '@/lib/navigation/admin-nav'
import { useFeatureFlags } from '@/lib/feature-flags'
import type { AdminNavSession } from '@/lib/navigation/admin-nav-permissions'
import { getModuleMaturity } from '@/lib/modules/module-maturity'
import { usePrefersReducedMotion } from '@/lib/hooks/use-prefers-reduced-motion'
import { useSidebarNavCounts } from '@/lib/hooks/use-sidebar-nav-counts'
import { cn } from '@/lib/utils/cn'

const PRIMARY_SECTIONS = [
  'Overview',
  'Executive',
  'Commerce',
  'Catalog',
  'Customers',
  'Marketing',
  'Content',
  'Finance',
  'Integrations',
] as const

const ADVANCED_SECTIONS: Array<{ title: string; groups: string[] }> = [
  {
    title: 'SEO & AI',
    groups: ['SEO Center', 'AI Center', 'Automation'],
  },
  {
    title: 'Operations',
    groups: ['Operations', 'WMS', 'Procurement', 'Production', 'Support', 'Delivery'],
  },
  {
    title: 'Platform',
    groups: ['Company OS', 'Media', 'Google Workspace', 'Security', 'System'],
  },
]

function groupByName(name: string, session?: AdminNavSession | null) {
  return getSidebarNavGroups(session).find((group) => group.group === name)
}

const SECTION_ICON_MAP: Record<string, string> = {
  Overview: 'LayoutDashboard',
  Executive: 'Crown',
  Commerce: 'ShoppingBag',
  Catalog: 'Package',
  Customers: 'Users',
  Marketing: 'Megaphone',
  Content: 'Layers',
  Finance: 'Wallet',
  Integrations: 'Plug',
  'SEO & AI': 'Sparkles',
  Operations: 'Workflow',
  Platform: 'Boxes',
}

function NavIcon({ name }: { name: string }) {
  const Icon = (Icons as unknown as Record<string, Icons.LucideIcon>)[name] ?? Icons.Circle
  return <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
}

function SidebarItem({
  item,
  collapsed,
  onNavigate,
  groupLabel,
  count,
}: {
  item: AdminNavItem
  collapsed: boolean
  onNavigate?: () => void
  groupLabel?: string
  count?: number
}) {
  const maturity = getModuleMaturity(item.href)
  const tooltip = collapsed
    ? groupLabel && groupLabel !== item.label
      ? `${groupLabel} · ${item.label}`
      : item.label
    : undefined
  const displayCount = count ?? (typeof item.badge === 'number' ? item.badge : undefined)

  return (
    <AdminNavLink
      href={item.href}
      {...(onNavigate ? { onNavigate } : {})}
      {...(tooltip ? { title: tooltip } : {})}
    >
      <span className="admin-nav-item__icon" aria-hidden="true">
        <NavIcon name={item.icon} />
      </span>
      {!collapsed ? <span className="min-w-0 flex-1 truncate">{item.label}</span> : null}
      {!collapsed && displayCount !== undefined ? (
        <span className="admin-nav-count" aria-label={`${displayCount} pending`}>
          {displayCount}
        </span>
      ) : null}
      {!collapsed && displayCount === undefined && typeof item.badge === 'string' ? (
        <span className="admin-nav-badge">{item.badge}</span>
      ) : null}
      {!collapsed && displayCount === undefined && !item.badge && maturity !== 'live' ? (
        <span className={cn('admin-nav-maturity', `admin-nav-maturity--${maturity}`)}>
          {maturity === 'beta' ? 'Beta' : 'Soon'}
        </span>
      ) : null}
    </AdminNavLink>
  )
}

function SidebarFlatSection({
  group,
  collapsed,
  onNavigate,
  getCount,
}: {
  group: AdminNavGroup
  collapsed: boolean
  onNavigate?: () => void
  getCount: (href: string) => number | undefined
}) {
  if (collapsed) {
    return (
      <div className="admin-sidebar__flat-section">
        <SidebarItem
          item={group.items[0]!}
          collapsed
          groupLabel={group.group}
          {...(onNavigate ? { onNavigate } : {})}
          {...(() => {
            const c = getCount(group.items[0]!.href)
            return c !== undefined ? { count: c } : {}
          })()}
        />
      </div>
    )
  }

  return (
    <section className="admin-sidebar__flat-section" aria-label={group.group}>
      <p className="admin-sidebar__flat-label">{group.group}</p>
      <div className="admin-sidebar__flat-items">
        {group.items.map((item) => {
          const c = getCount(item.href)
          return (
          <SidebarItem
            key={`${group.group}-${item.label}-${item.href}`}
            item={item}
            collapsed={false}
            {...(onNavigate ? { onNavigate } : {})}
            {...(c !== undefined ? { count: c } : {})}
          />
          )
        })}
      </div>
    </section>
  )
}

function SidebarDrawerSection({
  title,
  groups,
  collapsed,
  activePath,
  defaultOpen = false,
  variant = 'advanced',
  onNavigate,
  getCount,
}: {
  title: string
  groups: AdminNavGroup[]
  collapsed: boolean
  activePath: string
  defaultOpen?: boolean
  variant?: 'primary' | 'advanced'
  onNavigate?: () => void
  getCount: (href: string) => number | undefined
}) {
  const reduceMotion = usePrefersReducedMotion()
  const isActive = groups.some((group) =>
    group.items.some((item) => activePath === item.href || activePath.startsWith(`${item.href}/`)),
  )
  const [open, setOpen] = useState(defaultOpen || isActive)
  const itemCount = groups.reduce((total, group) => total + group.items.length, 0)
  const toolCountLabel = itemCount === 1 ? 'tool' : 'tools'

  useEffect(() => {
    if (isActive) setOpen(true)
  }, [isActive])

  const sectionIcon = SECTION_ICON_MAP[title] ?? groups[0]?.items[0]?.icon ?? 'Folder'

  if (collapsed) {
    return (
      <div className="mb-3 space-y-0.5">
        {groups.map((group) => {
          const c = getCount(group.items[0]!.href)
          return (
          <SidebarItem
            key={group.group}
            item={group.items[0]!}
            collapsed
            groupLabel={group.group}
            {...(onNavigate ? { onNavigate } : {})}
            {...(c !== undefined ? { count: c } : {})}
          />
          )
        })}
      </div>
    )
  }

  return (
    <div
      className={cn(
        'admin-sidebar__drawer',
        `admin-sidebar__drawer--${variant}`,
        isActive && 'admin-sidebar__drawer--active',
        open && 'admin-sidebar__drawer--open',
      )}
    >
      <span className="admin-sidebar__drawer-sheen" aria-hidden="true" />
      <button
        type="button"
        className="admin-sidebar__drawer-trigger"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <span className="admin-sidebar__drawer-leading">
          <span className="admin-sidebar__drawer-icon" aria-hidden="true">
            <NavIcon name={sectionIcon} />
          </span>
          <span className="min-w-0">
            <span className="admin-sidebar__drawer-title">{title}</span>
            <span className="admin-sidebar__drawer-meta">
              <span className="admin-sidebar__drawer-chip">{itemCount} {toolCountLabel}</span>
            </span>
          </span>
        </span>
        <span className={cn('admin-sidebar__drawer-chevron', open && 'admin-sidebar__drawer-chevron--open')}>
          <ChevronDown className="h-3.5 w-3.5" strokeWidth={2} />
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            {...(reduceMotion
              ? { initial: false, animate: { height: 'auto', opacity: 1 } }
              : {
                  initial: { height: 0, opacity: 0 },
                  animate: { height: 'auto', opacity: 1 },
                  exit: { height: 0, opacity: 0 },
                })}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="admin-sidebar__drawer-panel"
          >
            {groups.map((group) => (
              <div key={group.group} className="admin-sidebar__drawer-group">
                {groups.length > 1 ? <p className="admin-sidebar__drawer-group-label">{group.group}</p> : null}
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const c = getCount(item.href)
                    return (
                    <SidebarItem
                      key={`${group.group}-${item.label}-${item.href}`}
                      item={item}
                      collapsed={false}
                      {...(onNavigate ? { onNavigate } : {})}
                      {...(c !== undefined ? { count: c } : {})}
                    />
                    )
                  })}
                </div>
              </div>
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

function SidebarNav({
  collapsed,
  onNavigate,
  getCount,
  session,
}: {
  collapsed: boolean
  onNavigate?: () => void
  getCount: (href: string) => number | undefined
  session?: AdminNavSession | null
}) {
  const pathname = usePathname()
  useFeatureFlags() // re-render sidebar when feature flags hydrate from API
  const primaryGroups = PRIMARY_SECTIONS.map((name) => groupByName(name, session)).filter(Boolean) as AdminNavGroup[]
  const advancedGroups = ADVANCED_SECTIONS.map((section) => ({
    ...section,
    groups: section.groups.map((name) => groupByName(name, session)).filter(Boolean) as AdminNavGroup[],
  })).filter((section) => section.groups.length > 0)

  return (
    <>
      {primaryGroups.map((group) => (
        <SidebarFlatSection
          key={group.group}
          group={group}
          collapsed={collapsed}
          getCount={getCount}
          {...(onNavigate ? { onNavigate } : {})}
        />
      ))}

      {!collapsed ? (
        <p className="admin-sidebar__group admin-sidebar__group--advanced">
          <span className="admin-sidebar__group-line" aria-hidden="true" />
          Advanced modules
          <span className="admin-sidebar__group-line" aria-hidden="true" />
        </p>
      ) : null}

      {advancedGroups.map((section) => (
        <SidebarDrawerSection
          key={section.title}
          title={section.title}
          groups={section.groups}
          collapsed={collapsed}
          activePath={pathname}
          getCount={getCount}
          {...(onNavigate ? { onNavigate } : {})}
        />
      ))}
    </>
  )
}

export function AdminSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { data: sessionUser } = useAdminSession()
  const navSession = useMemo<AdminNavSession | null>(
    () =>
      sessionUser
        ? { role: sessionUser.role, permissions: sessionUser.permissions ?? [] }
        : null,
    [sessionUser],
  )
  const { api } = useAdminConnection(30_000)
  const connectionLive = api.pulse === 'online' || api.pulse === 'degraded'
  const navScrollRef = useRef<HTMLDivElement>(null)
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const reduceMotion = usePrefersReducedMotion()
  const { getCount } = useSidebarNavCounts()

  const sidebarTransition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.18, ease: [0.16, 1, 0.3, 1] as const }

  // Prefetch only the hottest post-login routes — blanket prefetch fights dashboard boot.
  useEffect(() => {
    if (!navSession) return
    const hot = ['/dashboard', '/dashboard/orders', '/dashboard/products', '/dashboard/menu-control']
    for (const href of hot) {
      try {
        router.prefetch(href)
      } catch {
        /* prefetch best-effort */
      }
    }
  }, [router, navSession])

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  useEffect(() => {
    const nav = navScrollRef.current
    if (!nav) return
    const frame = window.requestAnimationFrame(() => {
      const active = nav.querySelector('.admin-nav-item--active') as HTMLElement | null
      if (!active) return
      const navRect = nav.getBoundingClientRect()
      const activeRect = active.getBoundingClientRect()
      const outOfView = activeRect.top < navRect.top + 8 || activeRect.bottom > navRect.bottom - 8
      if (outOfView) active.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [pathname])

  const sidebarContent = (
    <>
      <div className="admin-sidebar__brand shrink-0">
        <SplaroAdminLogo
          variant={collapsed ? 'mark' : 'sidebar'}
          priority
          connectionLive={connectionLive}
        />
        {!collapsed ? (
          <p className="mt-2 text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-[var(--admin-text-muted)]">
            Commerce Admin
          </p>
        ) : null}
      </div>

      <div
        ref={navScrollRef}
        className="admin-sidebar__nav min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-2 py-3"
      >
        <SidebarNav
          collapsed={collapsed}
          getCount={getCount}
          session={navSession}
          onNavigate={() => setMobileOpen(false)}
        />
      </div>

      <div className="mx-2 mb-2 flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          className="admin-btn admin-btn--ghost hidden flex-1 lg:inline-flex justify-center py-2 text-xs"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          {!collapsed ? <span>Collapse</span> : null}
        </button>
      </div>
    </>
  )

  return (
    <>
      <button
        type="button"
        className="admin-btn admin-btn--ghost fixed left-4 top-4 z-[80] lg:hidden"
        onClick={() => setMobileOpen(true)}
        aria-label="Open menu"
      >
        <Menu className="h-4 w-4" />
      </button>

      <motion.aside
        animate={{ width: collapsed ? 88 : 280 }}
        transition={sidebarTransition}
        className={cn(
          'admin-sidebar admin-glass-panel relative m-4 mr-0 hidden h-[calc(100vh-2rem)] min-h-0 shrink-0 flex-col overflow-hidden lg:flex',
        )}
      >
        <span className="admin-glass-panel__surface" aria-hidden="true" />
        <span className="admin-glass-panel__sheen" aria-hidden="true" />
        <div className="admin-glass-panel__body relative flex min-h-0 flex-1 flex-col">
          {sidebarContent}
        </div>
      </motion.aside>

      <AnimatePresence>
        {mobileOpen ? (
          <>
            <motion.button
              type="button"
              aria-label="Close menu"
              {...(reduceMotion
                ? { initial: false, animate: { opacity: 1 } }
                : { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } })}
              transition={sidebarTransition}
              className="fixed inset-0 z-[90] bg-black/25 lg:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              {...(reduceMotion
                ? { initial: false, animate: { x: 0, opacity: 1 } }
                : {
                    initial: { x: -280, opacity: 0 },
                    animate: { x: 0, opacity: 1 },
                    exit: { x: -280, opacity: 0 },
                  })}
              transition={sidebarTransition}
              className="admin-sidebar admin-glass-panel fixed left-0 top-0 z-[100] m-0 flex h-full w-[280px] flex-col rounded-none lg:hidden"
            >
              <span className="admin-glass-panel__surface" aria-hidden="true" />
              <span className="admin-glass-panel__sheen" aria-hidden="true" />
              <div className="admin-glass-panel__body relative flex min-h-0 flex-1 flex-col">
              <button
                type="button"
                className="absolute right-3 top-3 rounded-full p-2 hover:bg-black/5"
                onClick={() => setMobileOpen(false)}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
              {sidebarContent}
              </div>
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>
    </>
  )
}
