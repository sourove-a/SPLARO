'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'

import { DcShell } from '@/components/dc'
import { DcCommandPalette } from '@/components/dc/DcCommandPalette'
import { DcNotificationsPopover } from '@/components/dc/DcNotificationsPopover'
import type { DcActivityItem, DcQuickAction, DcTone } from '@/components/dc'
import { useAdminSession, useDashboardInsights } from '@/lib/api/hooks'
import { useAdminConnection } from '@/lib/hooks/use-admin-connection'
import { useOnlinePresence } from '@/lib/hooks/use-online-presence'
import { getCommandItems, normalizeAdminHref } from '@/lib/navigation/admin-nav'
import { getHandoffSidebarNavGroups } from '@/lib/navigation/handoff-sidebar'
import type { AdminNavSession } from '@/lib/navigation/admin-nav-permissions'
import { useAdminUiStore } from '@/store/uiStore'

/** Quick actions in the right rail — the six the design pins there. */
const QUICK_ACTIONS: Array<Omit<DcQuickAction, 'onClick'> & { href: string }> = [
  { label: 'New order', icon: 'icon-plus', color: 'var(--violet)', href: '/dashboard/orders/new' },
  { label: 'Add product', icon: 'icon-package', color: 'var(--violet)', href: '/dashboard/products/new' },
  { label: 'Upload CSV', icon: 'icon-upload', color: 'var(--ink-3)', href: '/dashboard/bulk' },
  { label: 'Partner Tx', icon: 'icon-handshake', color: 'var(--violet)', href: '/dashboard/finance/partner-accounts' },
  { label: 'Daily close', icon: 'icon-calendar-check', color: 'var(--violet)', href: '/dashboard/finance/daily-closing' },
  {
    label: 'AI generator',
    icon: 'icon-sparkles',
    color: 'var(--violet)',
    href: '/dashboard/ai-agent',
    accent: true,
  },
]

/** Activity type → timeline dot colour. */
const ACTIVITY_DOT: Record<string, string> = {
  order: 'var(--violet)',
  customer: 'var(--info)',
  payment: 'var(--ok)',
  shipping: 'var(--info)',
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'SP'
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : ''
  return (first + last).toUpperCase() || 'SP'
}

export interface DcAdminShellProps {
  banner?: ReactNode
  children: ReactNode
}

export function DcAdminShell({ banner, children }: DcAdminShellProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { data: sessionUser } = useAdminSession()
  const { api, storefront, database, checking } = useAdminConnection(25_000)
  const apiReachable = api.pulse === 'online' || api.pulse === 'degraded'
  const { label: onlineLabel, title: onlineTitle } = useOnlinePresence(apiReachable)
  const setAgentChatOpen = useAdminUiStore((s) => s.setAgentChatOpen)
  const insights = useDashboardInsights('7 Days')
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifUnread, setNotifUnread] = useState(0)

  // The rail timeline shows real store activity — never a fixture.
  const activity: DcActivityItem[] = useMemo(
    () =>
      (insights.data?.recentActivities ?? []).slice(0, 8).map((a) => ({
        time: new Date(a.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        title: a.message,
        meta: a.type,
        dot: ACTIVITY_DOT[a.type] ?? 'var(--line-2)',
      })),
    [insights.data],
  )

  const navSession: AdminNavSession | null = useMemo(
    () =>
      sessionUser ? { role: sessionUser.role, permissions: sessionUser.permissions ?? [] } : null,
    [sessionUser],
  )

  const groups = useMemo(() => getHandoffSidebarNavGroups(navSession), [navSession])
  const commandItems = useMemo(() => getCommandItems(navSession), [navSession])

  const openPalette = useCallback(() => setPaletteOpen(true), [])
  const toggleNotifs = useCallback(() => setNotifOpen((v) => !v), [])
  const closeNotifs = useCallback(() => setNotifOpen(false), [])
  const onUnreadChange = useCallback((count: number) => setNotifUnread(count), [])

  // Unread only — never invent a badge from fixture NOTIFS.
  const notifBadge = notifUnread

  // ⌘K / Ctrl+K anywhere in the admin.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const activeHref = useMemo(() => normalizeAdminHref(pathname ?? '/dashboard'), [pathname])

  // Product create/edit already has a sticky readiness + storefront preview rail —
  // stacking the global Quick Actions rail makes the first viewport cramped.
  const hideShellRail = useMemo(() => {
    const p = pathname ?? ''
    return p.includes('/products/new') || /\/products\/[^/]+\/(edit|detail)/.test(p)
  }, [pathname])

  const { apiLabel, apiTone } = useMemo((): { apiLabel: string; apiTone: DcTone } => {
    if (checking && api.pulse === 'checking') return { apiLabel: 'CHECKING', apiTone: 'mute' }
    if (api.pulse === 'offline') return { apiLabel: 'API OFFLINE', apiTone: 'bad' }
    const degraded =
      api.pulse === 'degraded' || database.pulse !== 'online' || storefront.pulse !== 'online'
    if (degraded) return { apiLabel: 'DEGRADED', apiTone: 'warn' }
    return { apiLabel: api.latencyMs != null ? `LIVE · ${api.latencyMs}ms` : 'LIVE', apiTone: 'ok' }
  }, [api.pulse, api.latencyMs, database.pulse, storefront.pulse, checking])

  const quickActions: DcQuickAction[] = useMemo(
    () =>
      QUICK_ACTIONS.map(({ href, ...q }) => ({
        ...q,
        onClick: () => router.push(href),
      })),
    [router],
  )

  return (
    <DcShell
      groups={groups}
      activeHref={activeHref}
      user={{
        name: sessionUser?.name ?? 'SPLARO admin',
        role: sessionUser?.role ?? '—',
        initials: initialsOf(sessionUser?.name ?? 'SPLARO'),
      }}
      onSignOut={() => router.push('/api/auth/logout')}
      header={{
        apiLabel,
        apiTone,
        onlineLabel,
        ...(onlineTitle ? { onlineTitle } : {}),
        notifications: notifBadge,
        onOpenPalette: openPalette,
        onOpenNotifications: toggleNotifs,
      }}
      {...(hideShellRail ? {} : { rail: { quickActions, activity } })}
      {...(banner ? { banner } : {})}
      onAskSplaro={() => setAgentChatOpen(true)}
    >
      {children}
      <DcCommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        items={commandItems}
      />
      <DcNotificationsPopover
        open={notifOpen}
        onClose={closeNotifs}
        onUnreadChange={onUnreadChange}
      />
    </DcShell>
  )
}
