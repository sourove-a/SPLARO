'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import { DcIcon } from '@/components/dc/DcIcon'
import { FONT, MONO, toneStyle, type DcTone } from '@/components/dc/tokens'
import { toastFail, toastInfo, toastOk, toastWarn } from '@/lib/admin/feedback'
import type { NotificationLevel } from '@/lib/api/admin-hub'
import { useNotificationsOverview } from '@/lib/api/hooks'
import { formatRelativeTime } from '@/lib/api/orders'

const READ_KEY = 'splaro_dc_read_notification_ids'

/** Toasts fired for a single poll before the rest collapse into one summary. */
const MAX_TOASTS_PER_POLL = 4

function loadReadIds(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = localStorage.getItem(READ_KEY)
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
    localStorage.setItem(READ_KEY, JSON.stringify([...ids]))
  } catch {
    /* quota / private mode */
  }
}

const LEVEL_TONE: Record<NotificationLevel, DcTone> = {
  critical: 'bad',
  warn: 'warn',
  info: 'info',
}

/**
 * Severity beats delivery state. A new order is `critical` and must read red
 * even though its row is, technically, a successfully delivered notification.
 * Only when the API sends no level do we fall back to the delivery status.
 */
function rowTone(level: NotificationLevel | null | undefined, status: string): DcTone {
  if (level && LEVEL_TONE[level]) return LEVEL_TONE[level]
  const s = status.toUpperCase()
  if (s === 'FAILED' || s === 'ERROR') return 'bad'
  if (s === 'PENDING' || s === 'QUEUED') return 'warn'
  if (s === 'SENT' || s === 'DELIVERED') return 'ok'
  return 'info'
}

function channelIcon(channel: string, subject: string | null): string {
  const c = channel.toUpperCase()
  const s = subject?.toLowerCase() ?? ''
  if (c === 'IN_APP') {
    if (s.includes('new order')) return 'icon-shopping-bag'
    if (s.includes('new customer')) return 'icon-user-plus'
    if (s.includes('stock')) return 'icon-package'
    if (s.includes('sync')) return 'icon-refresh-cw'
    if (s.includes('courier')) return 'icon-truck'
    return 'icon-bell'
  }
  if (c === 'SMS') return 'icon-smartphone'
  if (c === 'TELEGRAM') return 'icon-send'
  if (c === 'WHATSAPP') return 'icon-message-square'
  return 'icon-mail'
}

function isNewOrder(subject: string | null): boolean {
  return (subject ?? '').toLowerCase().startsWith('new order')
}

export interface DcNotificationsPopoverProps {
  open: boolean
  onClose: () => void
  /**
   * Called whenever the unread tally changes so the header badge stays honest.
   * `critical` is the subset that must read red rather than violet.
   */
  onUnreadChange?: (count: number, critical: number) => void
}

export function DcNotificationsPopover({
  open,
  onClose,
  onUnreadChange,
}: DcNotificationsPopoverProps) {
  const router = useRouter()
  const { data, isLoading, isError, refetch } = useNotificationsOverview()
  const [readIds, setReadIds] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    setReadIds(loadReadIds())
  }, [])

  useEffect(() => {
    if (!open) return
    void refetch()
  }, [open, refetch])

  const items = useMemo(
    () =>
      (data?.logs ?? []).slice(0, 20).map((log) => ({
        id: log.id,
        title: log.subject?.trim() || log.body?.trim() || `${log.channel} → ${log.recipient}`,
        body: log.body?.trim() ?? '',
        // The body carries the detail an operator acts on — customer and
        // amount for an order, units left for a stock alert. Show it over a
        // generic channel label whenever there is one.
        sub:
          log.channel.toUpperCase() === 'IN_APP'
            ? log.body?.trim() || 'Admin alert · live'
            : `${log.channel} · ${log.status.toLowerCase()}`,
        time: formatRelativeTime(log.createdAt),
        icon: channelIcon(log.channel, log.subject),
        tone: rowTone(log.level, log.status),
        level: (log.level ?? 'info') as NotificationLevel,
        newOrder: isNewOrder(log.subject),
        href:
          log.channel.toUpperCase() === 'IN_APP' && log.recipient.startsWith('/dashboard/')
            ? log.recipient
            : '/dashboard/executive/notification-center',
      })),
    [data?.logs],
  )

  const unread = items.filter((item) => !readIds.has(item.id)).length
  const unreadCritical = items.filter(
    (item) => item.level === 'critical' && !readIds.has(item.id),
  ).length

  useEffect(() => {
    onUnreadChange?.(unread, unreadCritical)
  }, [unread, unreadCritical, onUnreadChange])

  // Toast alerts that land while the operator is on another screen. The first
  // poll only seeds the baseline — otherwise every page load would replay the
  // whole backlog as toasts.
  const seenIds = useRef<Set<string> | null>(null)
  useEffect(() => {
    if (!data?.logs) return
    if (seenIds.current === null) {
      seenIds.current = new Set(data.logs.map((log) => log.id))
      return
    }
    const seen = seenIds.current
    // Oldest first, so a burst of orders toasts in the order they arrived.
    const fresh = [...items].reverse().filter((item) => {
      const isNew = !seen.has(item.id)
      seen.add(item.id)
      return isNew && !readIds.has(item.id)
    })

    // A tab left open through a busy hour can come back to a dozen new alerts.
    // Toasting each one buries the screen, so show the first few and count the
    // rest — the tray itself holds the full list.
    for (const item of fresh.slice(0, MAX_TOASTS_PER_POLL)) {
      const line = item.body ? `${item.title} — ${item.body}` : item.title
      if (item.newOrder) toastOk(line, `notif:${item.id}`)
      else if (item.level === 'critical') toastFail(line, `notif:${item.id}`)
      else if (item.level === 'warn') toastWarn(line, `notif:${item.id}`)
    }
    const overflow = fresh.length - MAX_TOASTS_PER_POLL
    if (overflow > 0) {
      toastInfo(`+${overflow} more notification${overflow === 1 ? '' : 's'} — open the bell`)
    }
  }, [data?.logs, items, readIds])

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

  if (!open) {
    // Still mount unread accounting so the header badge stays honest while closed.
    return null
  }

  return (
    <>
      <button
        type="button"
        className="dc-popover-backdrop"
        aria-label="Close notifications"
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 95, border: 0, cursor: 'default' }}
      />
      <div
        role="dialog"
        className="dc-popover-card dc-popover-card--notifications"
        aria-label="Notifications"
        style={{
          position: 'fixed',
          top: 60,
          right: 22,
          zIndex: 96,
          width: 352,
          maxWidth: 'calc(100vw - 32px)',
          border: '1px solid var(--line-2)',
          borderRadius: 13,
          background: 'var(--surface)',
          overflow: 'hidden',
          fontFamily: FONT,
        }}
      >
        <div
          className="dc-popover-card__header"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 9,
            padding: '12px 14px',
            borderBottom: '1px solid var(--line)',
          }}
        >
          <span style={{ flex: 1, font: `600 13px/1 ${FONT}`, color: 'var(--ink)' }}>
            Notifications
          </span>
          {unreadCritical > 0 ? (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '3px 8px',
                borderRadius: 6,
                border: '1px solid var(--bad-bd)',
                background: 'var(--bad-soft)',
                color: 'var(--bad)',
                font: `700 10.5px/1 ${FONT}`,
                letterSpacing: '.05em',
              }}
            >
              <span style={{ width: 5, height: 5, borderRadius: 99, background: 'currentColor' }} />
              {unreadCritical} URGENT
            </span>
          ) : null}
          {items.length > 0 && unread > 0 ? (
            <button
              type="button"
              onClick={markAllRead}
              className="dc-hover-ink"
              style={{
                height: 26,
                padding: '0 9px',
                borderRadius: 7,
                border: '1px solid var(--line)',
                background: 'transparent',
                color: 'var(--ink-3)',
                cursor: 'pointer',
                font: `600 11px/1 ${FONT}`,
              }}
            >
              Mark all read
            </button>
          ) : null}
          <button
            type="button"
            className="dc-popover-card__close-btn dc-hover-surface"
            aria-label="Close notifications"
            onClick={onClose}
            style={{
              display: 'none',
              placeItems: 'center',
              width: 28,
              height: 28,
              borderRadius: 7,
              border: '1px solid var(--line)',
              background: 'var(--surface-2)',
              color: 'var(--ink-2)',
              cursor: 'pointer',
            }}
          >
            <DcIcon name="icon-x" size={14} />
          </button>
        </div>

        <div style={{ maxHeight: 'min(60vh, 420px)', overflowY: 'auto' }}>
          {isLoading ? (
            <div
              style={{
                padding: '34px 20px',
                textAlign: 'center',
                font: `500 12.5px/1.4 ${FONT}`,
                color: 'var(--ink-3)',
              }}
            >
              Loading notifications…
            </div>
          ) : isError ? (
            <div
              style={{
                padding: '34px 20px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <span style={{ font: `500 12.5px/1.4 ${FONT}`, color: 'var(--bad)', textAlign: 'center' }}>
                Notifications API offline.
              </span>
              <button
                type="button"
                onClick={() => void refetch()}
                style={{
                  height: 28,
                  padding: '0 12px',
                  borderRadius: 8,
                  border: '1px solid var(--line)',
                  background: 'var(--surface-2)',
                  color: 'var(--ink-2)',
                  cursor: 'pointer',
                  font: `600 11.5px/1 ${FONT}`,
                }}
              >
                Retry
              </button>
            </div>
          ) : items.length === 0 ? (
            <div
              style={{
                padding: '34px 20px',
                textAlign: 'center',
                font: `500 12.5px/1.45 ${FONT}`,
                color: 'var(--ink-3)',
              }}
            >
              No notifications yet. New orders, customer signups, and message deliveries appear here.
            </div>
          ) : (
            items.map((nt) => {
              const tone = toneStyle(nt.tone)
              const isUnread = !readIds.has(nt.id)
              const urgent = nt.level === 'critical'
              return (
                <button
                  key={nt.id}
                  type="button"
                  onClick={() => {
                    markRead(nt.id)
                    onClose()
                    router.push(nt.href)
                  }}
                  className="dc-hover-line"
                  style={{
                    display: 'flex',
                    gap: 10,
                    width: '100%',
                    padding: '11px 14px',
                    border: 0,
                    // A red rail down the left edge is what makes an unread
                    // order readable at a glance from across the room.
                    borderLeft: `3px solid ${urgent && isUnread ? 'var(--bad)' : 'transparent'}`,
                    borderBottom: '1px solid var(--line)',
                    background: isUnread
                      ? urgent
                        ? 'var(--bad-soft)'
                        : 'var(--violet-soft)'
                      : 'transparent',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span
                    style={{
                      display: 'grid',
                      placeItems: 'center',
                      width: 26,
                      height: 26,
                      flex: 'none',
                      borderRadius: 8,
                      background: tone.bg,
                      color: tone.fg,
                    }}
                  >
                    <DcIcon name={nt.icon} size={12} />
                  </span>
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                    }}
                  >
                    <span
                      style={{
                        font: `${isUnread ? 600 : 500} 12.5px/1.3 ${FONT}`,
                        color: 'var(--ink)',
                      }}
                    >
                      {nt.title}
                    </span>
                    <span
                      style={{
                        font: `400 11px/1.4 ${FONT}`,
                        color: 'var(--ink-3)',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {nt.sub}
                    </span>
                  </span>
                  <span
                    style={{
                      flex: 'none',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-end',
                      gap: 5,
                    }}
                  >
                    <span style={{ font: `400 10.5px/1 ${MONO}`, color: 'var(--ink-3)' }}>
                      {nt.time}
                    </span>
                    {isUnread ? (
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: 99,
                          background: urgent ? 'var(--bad)' : 'var(--violet)',
                        }}
                      />
                    ) : null}
                  </span>
                </button>
              )
            })
          )}
        </div>

        <div
          style={{
            borderTop: '1px solid var(--line)',
            padding: 8,
            background: 'var(--surface-2)',
          }}
        >
          <button
            type="button"
            onClick={() => {
              onClose()
              router.push('/dashboard/executive/notification-center')
            }}
            className="dc-hover-ink"
            style={{
              display: 'flex',
              width: '100%',
              justifyContent: 'center',
              height: 32,
              borderRadius: 9,
              border: 0,
              background: 'transparent',
              color: 'var(--ink-2)',
              cursor: 'pointer',
              font: `600 12px/1 ${FONT}`,
            }}
          >
            Open notification center
          </button>
        </div>
      </div>
    </>
  )
}
