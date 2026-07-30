'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

import { DcIcon } from '@/components/dc/DcIcon'
import { FONT, MONO, toneStyle, type DcTone } from '@/components/dc/tokens'
import { useNotificationsOverview } from '@/lib/api/hooks'
import { formatRelativeTime } from '@/lib/api/orders'

const READ_KEY = 'splaro_dc_read_notification_ids'

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

function channelTone(status: string): DcTone {
  const s = status.toUpperCase()
  if (s === 'FAILED' || s === 'ERROR') return 'bad'
  if (s === 'PENDING' || s === 'QUEUED') return 'warn'
  if (s === 'SENT' || s === 'DELIVERED') return 'ok'
  return 'info'
}

function channelIcon(channel: string): string {
  const c = channel.toUpperCase()
  if (c === 'SMS') return 'icon-smartphone'
  if (c === 'TELEGRAM') return 'icon-send'
  if (c === 'WHATSAPP') return 'icon-message-square'
  return 'icon-mail'
}

export interface DcNotificationsPopoverProps {
  open: boolean
  onClose: () => void
  /** Called whenever unread count changes so the header badge stays honest. */
  onUnreadChange?: (count: number) => void
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

  const items = useMemo(
    () =>
      (data?.logs ?? []).slice(0, 20).map((log) => ({
        id: log.id,
        title: log.subject?.trim() || log.body?.trim() || `${log.channel} → ${log.recipient}`,
        sub: `${log.channel} · ${log.status.toLowerCase()}`,
        time: formatRelativeTime(log.createdAt),
        icon: channelIcon(log.channel),
        tone: channelTone(log.status),
      })),
    [data?.logs],
  )

  const unread = items.filter((item) => !readIds.has(item.id)).length

  useEffect(() => {
    onUnreadChange?.(unread)
  }, [unread, onUnreadChange])

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
        aria-label="Close notifications"
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 95, border: 0, background: 'transparent', cursor: 'default' }}
      />
      <div
        role="dialog"
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
              No notifications yet. Email, SMS, WhatsApp, and Telegram deliveries appear here when sent.
            </div>
          ) : (
            items.map((nt) => {
              const tone = toneStyle(nt.tone)
              const isUnread = !readIds.has(nt.id)
              return (
                <button
                  key={nt.id}
                  type="button"
                  onClick={() => {
                    markRead(nt.id)
                    onClose()
                    router.push('/dashboard/executive/notification-center')
                  }}
                  className="dc-hover-line"
                  style={{
                    display: 'flex',
                    gap: 10,
                    width: '100%',
                    padding: '11px 14px',
                    border: 0,
                    borderBottom: '1px solid var(--line)',
                    background: isUnread ? 'var(--violet-soft)' : 'transparent',
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
                    <span style={{ font: `400 11px/1.4 ${FONT}`, color: 'var(--ink-3)' }}>
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
                          background: 'var(--violet)',
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
