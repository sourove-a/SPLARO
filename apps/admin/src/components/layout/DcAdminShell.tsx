'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { DcShell } from '@/components/dc'
import {
  isTypingTarget,
  parseRecentPages,
  pushRecentPage,
  RECENT_PAGES_KEY,
  resolveGotoKey,
  type RecentPage,
} from '@/lib/navigation/keyboard-nav'
import { DcAdminProfilePopover } from '@/components/dc/DcAdminProfilePopover'
import { DcCommandPalette } from '@/components/dc/DcCommandPalette'
import { DcConnectionPopover } from '@/components/dc/DcConnectionPopover'
import { DcNotificationsPopover } from '@/components/dc/DcNotificationsPopover'
import { DcPresencePopover } from '@/components/dc/DcPresencePopover'
import type { DcActivityItem, DcQuickAction, DcTone } from '@/components/dc'
import { useAdminSession, useDashboardInsights } from '@/lib/api/hooks'
import { fetchAdminAuthProfile } from '@/lib/api/auth-profile'
import { useAdminConnection } from '@/lib/hooks/use-admin-connection'
import { useOnlinePresence } from '@/lib/hooks/use-online-presence'
import { getCommandItems, normalizeAdminHref } from '@/lib/navigation/admin-nav'
import { getHandoffSidebarNavGroups } from '@/lib/navigation/handoff-sidebar'
import type { AdminNavSession } from '@/lib/navigation/admin-nav-permissions'
import { canEditAdminProfile, formatAdminDisplayName, formatAdminRoleLabel } from '@/lib/auth/role-label'
import { useAdminUiStore } from '@/store/uiStore'
import { useAdminOrdersRealtime } from '@/lib/realtime/useAdminOrdersRealtime'

/** Quick actions in the right rail — the six the design pins there. */
// Violet is reserved for active nav and primary buttons, so these icons use the
// neutral ink ramp rather than the brand colour.
const QUICK_ACTIONS: Array<Omit<DcQuickAction, 'onClick'> & { href: string }> = [
  { label: 'New order', icon: 'icon-plus', color: 'var(--ink-2)', href: '/dashboard/orders/new' },
  { label: 'Add product', icon: 'icon-package', color: 'var(--ink-2)', href: '/dashboard/products/new' },
  { label: 'Upload CSV', icon: 'icon-upload', color: 'var(--ink-3)', href: '/dashboard/bulk' },
  { label: 'Partner Tx', icon: 'icon-handshake', color: 'var(--ink-2)', href: '/dashboard/finance/partner-accounts' },
  { label: 'Daily close', icon: 'icon-calendar-check', color: 'var(--ink-2)', href: '/dashboard/finance/daily-closing' },
  {
    label: 'AI generator',
    icon: 'icon-sparkles',
    color: 'var(--ink-2)',
    href: '/dashboard/ai-agent',
    accent: true,
  },
]

/** Activity type → timeline dot colour. Status palette only, never violet. */
const ACTIVITY_DOT: Record<string, string> = {
  order: 'var(--ok)',
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
  const gotoArmedAt = useRef<number | null>(null)
  const [recentPages, setRecentPages] = useState<RecentPage[]>([])
  const router = useRouter()
  const { data: sessionUser } = useAdminSession()
  const qc = useQueryClient()
  useAdminOrdersRealtime(Boolean(sessionUser))
  const { api, storefront, database, checking, refresh: refreshConnection } = useAdminConnection(25_000)
  const apiReachable = api.pulse === 'online' || api.pulse === 'degraded'
  const {
    label: onlineLabel,
    title: onlineTitle,
    presence,
    onlineAdmins,
    onlineAdminsLoading,
  } = useOnlinePresence(apiReachable)
  const [onlineOpen, setOnlineOpen] = useState(false)
  const [connOpen, setConnOpen] = useState(false)
  const setAgentChatOpen = useAdminUiStore((s) => s.setAgentChatOpen)
  const insights = useDashboardInsights('7 Days')
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifUnread, setNotifUnread] = useState(0)
  const [notifUrgent, setNotifUrgent] = useState(0)
  const [profileOpen, setProfileOpen] = useState(false)
  const [profileExtras, setProfileExtras] = useState<{
    canChangePassword: boolean
    lastLoginIp: string | null
    lastLoginAt: string | null
    requestIp: string | null
  }>({ canChangePassword: false, lastLoginIp: null, lastLoginAt: null, requestIp: null })

  useEffect(() => {
    if (!profileOpen || !apiReachable) return
    let cancelled = false
    void fetchAdminAuthProfile()
      .then((data) => {
        if (cancelled) return
        setProfileExtras({
          canChangePassword: Boolean(data.canChangePassword),
          lastLoginIp: data.lastLoginIp ?? null,
          lastLoginAt: data.lastLoginAt ?? null,
          requestIp: data.requestIp ?? null,
        })
      })
      .catch(() => {
        /* profile extras are best-effort */
      })
    return () => {
      cancelled = true
    }
  }, [profileOpen, apiReachable])

  // Also capture client IP from the admin BFF /api/auth/me when available.
  useEffect(() => {
    let cancelled = false
    void fetch('/api/auth/me', { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok || cancelled) return
        const data = (await res.json()) as { clientIp?: string | null }
        if (!cancelled && data.clientIp) {
          setProfileExtras((prev) => ({ ...prev, requestIp: prev.requestIp || data.clientIp || null }))
        }
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [sessionUser?.id])

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
  const openOnline = useCallback(() => setOnlineOpen(true), [])
  const closeOnline = useCallback(() => setOnlineOpen(false), [])
  const openConnection = useCallback(() => setConnOpen(true), [])
  const closeConnection = useCallback(() => setConnOpen(false), [])
  const onUnreadChange = useCallback((count: number, critical: number) => {
    setNotifUnread(count)
    setNotifUrgent(critical)
  }, [])

  // Unread only — never invent a badge from fixture NOTIFS.
  const notifBadge = notifUnread

  // ⌘K / Ctrl+K anywhere in the admin, plus "g then x" jumps.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((v) => !v)
        return
      }

      const result = resolveGotoKey(
        { armedAt: gotoArmedAt.current },
        e.key,
        {
          now: Date.now(),
          hasModifier: e.metaKey || e.ctrlKey || e.altKey,
          // Never steal a keystroke from a field — typing "go" in the order
          // search must stay text, not navigation.
          typing: isTypingTarget(e.target),
        },
      )

      if (result.action === 'arm') {
        gotoArmedAt.current = Date.now()
        return
      }
      if (result.action === 'reset') {
        gotoArmedAt.current = null
        return
      }
      if (result.action === 'navigate') {
        e.preventDefault()
        gotoArmedAt.current = null
        router.push(result.href)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [router])

  const activeHref = useMemo(() => normalizeAdminHref(pathname ?? '/dashboard'), [pathname])

  /**
   * Recent pages.
   *
   * Written on navigation and read back through the palette, so an operator who
   * was three screens deep can return without walking the menu again. Stored in
   * sessionStorage: it is a trail through this sitting, not a saved preference,
   * and it must not follow one admin onto the next person's session.
   */
  useEffect(() => {
    if (typeof window === 'undefined' || !activeHref) return
    const label =
      commandItems.find((item) => normalizeAdminHref(item.href) === activeHref)?.label ??
      activeHref.split('/').filter(Boolean).slice(-1)[0] ??
      'Dashboard'
    try {
      const next = pushRecentPage(
        parseRecentPages(window.sessionStorage.getItem(RECENT_PAGES_KEY)),
        { href: activeHref, label, at: Date.now() },
      )
      window.sessionStorage.setItem(RECENT_PAGES_KEY, JSON.stringify(next))
      setRecentPages(next)
    } catch {
      // Private mode or a full quota — recents are a convenience, not a feature
      // the shell may fail on.
    }
  }, [activeHref, commandItems])

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

  const displayName = formatAdminDisplayName(sessionUser?.name ?? 'SPLARO admin', sessionUser?.email)
  const displayRole = formatAdminRoleLabel(sessionUser?.role ?? 'ADMIN', sessionUser?.email)
  const displayInitials = initialsOf(displayName)

  return (
    <DcShell
      groups={groups}
      activeHref={activeHref}
      user={{
        name: displayName,
        role: displayRole,
        initials: displayInitials,
        ...(sessionUser?.email ? { email: sessionUser.email } : {}),
      }}
      onSignOut={() => router.push('/api/auth/logout')}
      onOpenProfile={() => setProfileOpen(true)}
      header={{
        apiLabel,
        apiTone,
        onlineLabel,
        ...(onlineTitle ? { onlineTitle } : {}),
        notifications: notifBadge,
        notificationsUrgent: notifUrgent > 0,
        onOpenPalette: openPalette,
        onOpenNotifications: toggleNotifs,
        onOpenOnline: openOnline,
        onOpenConnection: openConnection,
      }}
      {...(hideShellRail ? {} : { rail: { quickActions, activity } })}
      {...(banner ? { banner } : {})}
      onAskSplaro={() => setAgentChatOpen(true)}
    >
      {children}
      <DcAdminProfilePopover
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        onSignOut={() => router.push('/api/auth/logout')}
        name={displayName}
        email={sessionUser?.email ?? ''}
        role={displayRole}
        initials={displayInitials}
        clientIp={profileExtras.requestIp}
        lastLoginIp={profileExtras.lastLoginIp}
        lastLoginAt={profileExtras.lastLoginAt}
        canChangePassword={profileExtras.canChangePassword}
        canEditProfile={canEditAdminProfile(sessionUser?.role)}
        onNameSaved={() => {
          void qc.invalidateQueries({ queryKey: ['admin-session'] })
        }}
        presence={presence ?? null}
      />
      <DcCommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        items={commandItems}
        recent={recentPages}
      />
      <DcNotificationsPopover
        open={notifOpen}
        onClose={closeNotifs}
        onUnreadChange={onUnreadChange}
      />
      <DcPresencePopover
        open={onlineOpen}
        onClose={closeOnline}
        admins={onlineAdmins?.admins}
        storefrontCount={presence?.storefront ?? 0}
        loading={onlineAdminsLoading}
      />
      <DcConnectionPopover
        open={connOpen}
        onClose={closeConnection}
        api={api}
        database={database}
        storefront={storefront}
        onRetry={refreshConnection}
      />
    </DcShell>
  )
}
