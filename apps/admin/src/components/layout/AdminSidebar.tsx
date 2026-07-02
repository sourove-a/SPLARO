'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import * as Icons from 'lucide-react'
import { ChevronDown, ChevronLeft, ChevronRight, Menu, X } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import { SplaroAdminLogo } from '@/components/brand/SplaroAdminLogo'
import { AdminNavLink } from '@/components/layout/AdminNavLink'
import { useAdminConnection } from '@/lib/hooks/use-admin-connection'
import { adminNavGroups, type AdminNavGroup, type AdminNavItem } from '@/lib/navigation/admin-nav'
import { getModuleMaturity } from '@/lib/modules/module-maturity'
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
    groups: [
      'Company OS',
      'Media',
      'Marketplace',
      'Social Commerce',
      'Developer',
      'Observability',
      'Google Workspace',
      'SaaS',
      'Security',
      'System',
    ],
  },
]

function groupByName(name: string) {
  return adminNavGroups.find((group) => group.group === name)
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
}: {
  item: AdminNavItem
  collapsed: boolean
  onNavigate?: () => void
  groupLabel?: string
}) {
  const maturity = getModuleMaturity(item.href)
  const tooltip = collapsed
    ? groupLabel && groupLabel !== item.label
      ? `${groupLabel} · ${item.label}`
      : item.label
    : undefined

  return (
    <AdminNavLink
      href={item.href}
      {...(onNavigate ? { onNavigate } : {})}
      {...(tooltip ? { title: tooltip } : {})}
    >
      <NavIcon name={item.icon} />
      {!collapsed ? <span className="truncate">{item.label}</span> : null}
      {!collapsed && item.badge ? (
        <span className="admin-nav-badge">{item.badge}</span>
      ) : null}
      {!collapsed && !item.badge && maturity !== 'live' ? (
        <span className={cn('admin-nav-maturity', `admin-nav-maturity--${maturity}`)}>
          {maturity === 'beta' ? 'Beta' : 'Soon'}
        </span>
      ) : null}
    </AdminNavLink>
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
}: {
  title: string
  groups: AdminNavGroup[]
  collapsed: boolean
  activePath: string
  defaultOpen?: boolean
  variant?: 'primary' | 'advanced'
  onNavigate?: () => void
}) {
  const isActive = groups.some((group) =>
    group.items.some((item) => activePath === item.href || activePath.startsWith(`${item.href}/`)),
  )
  const [open, setOpen] = useState(defaultOpen || isActive)
  const itemCount = groups.reduce((total, group) => total + group.items.length, 0)
  const sectionCountLabel = groups.length === 1 ? 'section' : 'sections'
  const toolCountLabel = itemCount === 1 ? 'tool' : 'tools'

  useEffect(() => {
    if (isActive) setOpen(true)
  }, [isActive])

  if (collapsed) {
    return (
      <div className="mb-3 space-y-0.5">
        {groups.map((group) => (
          <SidebarItem
            key={group.group}
            item={group.items[0]!}
            collapsed
            groupLabel={group.group}
            {...(onNavigate ? { onNavigate } : {})}
          />
        ))}
      </div>
    )
  }

  return (
    <div className={cn('admin-sidebar__drawer', `admin-sidebar__drawer--${variant}`, isActive && 'admin-sidebar__drawer--active')}>
      <button
        type="button"
        className="admin-sidebar__drawer-trigger"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <span className="min-w-0">
          <span className="admin-sidebar__drawer-title">{title}</span>
          <span className="admin-sidebar__drawer-meta">
            {groups.length} {sectionCountLabel} · {itemCount} {toolCountLabel}
          </span>
        </span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform', open && 'rotate-180')} strokeWidth={1.8} />
      </button>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="admin-sidebar__drawer-panel"
          >
            {groups.map((group) => (
              <div key={group.group} className="admin-sidebar__drawer-group">
                {groups.length > 1 ? <p className="admin-sidebar__drawer-group-label">{group.group}</p> : null}
                <div className="space-y-0.5">
                  {group.items.map((item) => (
                    <SidebarItem
                      key={`${group.group}-${item.label}-${item.href}`}
                      item={item}
                      collapsed={false}
                      {...(onNavigate ? { onNavigate } : {})}
                    />
                  ))}
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
}: {
  collapsed: boolean
  onNavigate?: () => void
}) {
  const pathname = usePathname()
  const primaryGroups = PRIMARY_SECTIONS.map(groupByName).filter(Boolean) as AdminNavGroup[]
  const advancedGroups = ADVANCED_SECTIONS.map((section) => ({
    ...section,
    groups: section.groups.map(groupByName).filter(Boolean) as AdminNavGroup[],
  })).filter((section) => section.groups.length > 0)

  return (
    <>
      {primaryGroups.map((group) => (
        <SidebarDrawerSection
          key={group.group}
          title={group.group}
          groups={[group]}
          collapsed={collapsed}
          activePath={pathname}
          defaultOpen={group.group === 'Overview' || group.group === 'Commerce'}
          variant="primary"
          {...(onNavigate ? { onNavigate } : {})}
        />
      ))}

      {!collapsed ? (
        <p className="admin-sidebar__group admin-sidebar__group--advanced">
          Advanced · আরো টুলস
        </p>
      ) : null}

      {advancedGroups.map((section) => (
        <SidebarDrawerSection
          key={section.title}
          title={section.title}
          groups={section.groups}
          collapsed={collapsed}
          activePath={pathname}
          {...(onNavigate ? { onNavigate } : {})}
        />
      ))}
    </>
  )
}

export function AdminSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { api } = useAdminConnection(30_000)
  const connectionLive = api.pulse === 'online' || api.pulse === 'degraded'
  const navScrollRef = useRef<HTMLDivElement>(null)
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    for (const group of adminNavGroups) {
      for (const item of group.items) {
        try {
          router.prefetch(item.href)
        } catch {
          /* prefetch best-effort */
        }
      }
    }
  }, [router])

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
        <SidebarNav collapsed={collapsed} onNavigate={() => setMobileOpen(false)} />
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
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        className={cn(
          'admin-sidebar relative m-4 mr-0 hidden h-[calc(100vh-2rem)] min-h-0 shrink-0 flex-col overflow-hidden lg:flex',
        )}
      >
        {sidebarContent}
      </motion.aside>

      <AnimatePresence>
        {mobileOpen ? (
          <>
            <motion.button
              type="button"
              aria-label="Close menu"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[90] bg-black/20 backdrop-blur-sm lg:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: -300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -300, opacity: 0 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              className="admin-sidebar fixed left-0 top-0 z-[100] m-0 flex h-full w-[280px] flex-col rounded-none lg:hidden"
            >
              <button
                type="button"
                className="absolute right-3 top-3 rounded-full p-2 hover:bg-black/5"
                onClick={() => setMobileOpen(false)}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
              {sidebarContent}
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>
    </>
  )
}
