'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bell,
  CheckCheck,
  Loader2,
  Mail,
  MessageCircle,
  Send,
  Smartphone,
} from 'lucide-react'
import { AdminNavLink } from '@/components/layout/AdminNavLink'
import { RelativeTime } from '@/components/ui/RelativeTime'
import { useNotificationsOverview } from '@/lib/api/hooks'

const READ_STORAGE_KEY = 'splaro_admin_read_notification_ids'

type NotifyIcon = typeof Mail

function channelIcon(channel: string): NotifyIcon {
  const c = channel.toUpperCase()
  if (c === 'SMS') return Smartphone
  if (c === 'WHATSAPP') return MessageCircle
  if (c === 'TELEGRAM') return Send
  return Mail
}

function loadReadIds(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = localStorage.getItem(READ_STORAGE_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((id): id is string => typeof id === 'string'))
  } catch {
    return new Set()
  }
}

function saveReadIds(ids: Set<string>) {
  try {
    localStorage.setItem(READ_STORAGE_KEY, JSON.stringify([...ids]))
  } catch {
    /* quota / private mode */
  }
}

export function NotificationDropdown() {
  const [open, setOpen] = useState(false)
  const [readIds, setReadIds] = useState<Set<string>>(() => new Set())
  const { data, isLoading, isError, refetch, isFetching } = useNotificationsOverview()

  useEffect(() => {
    setReadIds(loadReadIds())
  }, [])

  const items = useMemo(() => {
    return (data?.logs ?? []).slice(0, 20).map((log) => ({
      id: log.id,
      title: log.subject?.trim() || log.body?.trim() || `${log.channel} to ${log.recipient}`,
      subtitle: `${log.channel} · ${log.status.toLowerCase()}`,
      timeIso: log.createdAt,
      icon: channelIcon(log.channel),
      href: '/dashboard/executive/notification-center',
    }))
  }, [data?.logs])

  const unread = items.filter((item) => !readIds.has(item.id)).length

  const markRead = useCallback((id: string) => {
    setReadIds((prev) => {
      const next = new Set(prev)
      next.add(id)
      saveReadIds(next)
      return next
    })
  }, [])

  const markAllRead = useCallback(() => {
    if (!items.length) return
    setReadIds((prev) => {
      const next = new Set(prev)
      for (const item of items) next.add(item.id)
      saveReadIds(next)
      return next
    })
  }, [items])

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="admin-header-chip"
        aria-label="Notifications"
        aria-expanded={open}
      >
        <Bell className="h-4 w-4" strokeWidth={2} />
        {unread > 0 ? (
          <span className="admin-header-badge" aria-hidden>
            {unread > 9 ? '9+' : unread}
          </span>
        ) : null}
      </button>

      <AnimatePresence>
        {open ? (
          <>
            <button
              type="button"
              aria-label="Close notifications"
              className="fixed inset-0 z-[250] cursor-default bg-black/5 backdrop-blur-[1px]"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              className="admin-header-popover fixed right-4 top-[5.25rem] z-[300] w-80 overflow-hidden rounded-[22px] sm:right-6"
            >
              <div className="flex items-center justify-between border-b border-[var(--admin-glass-border)] px-4 py-3">
                <div>
                  <p className="text-sm font-black text-[var(--admin-text)]">Notifications</p>
                  <p className="text-[10px] font-semibold text-[var(--admin-text-secondary)]">
                    Live delivery log
                  </p>
                </div>
                {items.length > 0 && unread > 0 ? (
                  <button
                    type="button"
                    onClick={markAllRead}
                    className="flex items-center gap-1 text-[10px] font-bold text-[var(--admin-text-secondary)] hover:text-[var(--admin-text)]"
                  >
                    <CheckCheck className="h-3.5 w-3.5" />
                    Mark all read
                  </button>
                ) : null}
              </div>

              {isLoading || isFetching ? (
                <div className="flex items-center justify-center gap-2 px-4 py-10 text-xs font-semibold text-[var(--admin-text-secondary)]">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading notifications…
                </div>
              ) : isError ? (
                <div className="px-4 py-8 text-center">
                  <p className="text-xs font-semibold text-[var(--admin-danger)]">
                    Notifications API offline.
                  </p>
                  <button
                    type="button"
                    onClick={() => void refetch()}
                    className="mt-3 text-[10px] font-bold text-[var(--admin-text)] underline"
                  >
                    Retry
                  </button>
                </div>
              ) : items.length === 0 ? (
                <p className="px-4 py-8 text-center text-xs font-semibold leading-relaxed text-[var(--admin-text-secondary)]">
                  No notifications yet. Email, SMS, WhatsApp, and Telegram deliveries will appear here when sent.
                </p>
              ) : (
                <ul className="max-h-80 overflow-y-auto p-2">
                  {items.map((item) => {
                    const Icon = item.icon
                    const isUnread = !readIds.has(item.id)
                    return (
                      <li key={item.id}>
                        <AdminNavLink
                          href={item.href}
                          onNavigate={() => {
                            setOpen(false)
                            markRead(item.id)
                          }}
                          className={`mb-1 flex items-start gap-3 rounded-[16px] px-3 py-2.5 ${
                            isUnread ? 'bg-[var(--admin-gold-muted)]' : 'hover:bg-[var(--admin-surface-hover)]'
                          }`}
                        >
                          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[var(--admin-glass-border)] bg-[var(--admin-surface)] shadow-sm">
                            <Icon className="h-4 w-4 text-[#5E7CFF]" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="line-clamp-2 text-xs font-bold leading-5 text-[var(--admin-text)]">
                              {item.title}
                            </p>
                            <p className="text-[10px] font-semibold text-[var(--admin-text-secondary)]">
                              {item.subtitle}
                              {' · '}
                              <RelativeTime iso={item.timeIso} />
                            </p>
                          </div>
                          {isUnread ? (
                            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#5E7CFF]" />
                          ) : null}
                        </AdminNavLink>
                      </li>
                    )
                  })}
                </ul>
              )}

              <div className="border-t border-[var(--admin-glass-border)] p-2">
                <AdminNavLink
                  href="/dashboard/executive/notification-center"
                  onNavigate={() => setOpen(false)}
                  className="flex w-full justify-center rounded-[14px] py-2 text-xs font-black text-[var(--admin-text)] hover:bg-[var(--admin-surface-hover)]"
                >
                  Open notification center
                </AdminNavLink>
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
