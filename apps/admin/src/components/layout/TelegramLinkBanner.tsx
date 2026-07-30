'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { DcIcon } from '@/components/dc/DcIcon'
import { FONT } from '@/components/dc/tokens'
import { fetchMyTelegramStatus } from '@/lib/api/security'

const DISMISS_KEY = 'splaro.admin.telegramBanner.dismissed'

function readDismissed(): boolean {
  try {
    if (window.localStorage.getItem(DISMISS_KEY) === '1') return true
    if (window.sessionStorage.getItem(DISMISS_KEY) === '1') return true
  } catch {
    /* private mode */
  }
  return false
}

function writeDismissed() {
  try {
    window.localStorage.setItem(DISMISS_KEY, '1')
  } catch {
    /* ignore */
  }
  try {
    window.sessionStorage.setItem(DISMISS_KEY, '1')
  } catch {
    /* ignore */
  }
}

/**
 * Design banner: “Link your Telegram — … Link now”.
 * Always opens dedicated Telegram Bot screen (Admin Linking) — never Settings SMTP.
 */
export function TelegramLinkBanner() {
  const router = useRouter()
  const [dismissed, setDismissed] = useState<boolean | null>(null)
  const { data, isLoading, isError } = useQuery({
    queryKey: ['my-telegram-status'],
    queryFn: fetchMyTelegramStatus,
    staleTime: 60_000,
    retry: 1,
  })

  useEffect(() => {
    setDismissed(readDismissed())
  }, [])

  useEffect(() => {
    if (data?.telegramLinked) {
      try {
        window.localStorage.removeItem(DISMISS_KEY)
        window.sessionStorage.removeItem(DISMISS_KEY)
      } catch {
        /* ignore */
      }
    }
  }, [data?.telegramLinked])

  if (dismissed === null || dismissed || isLoading || isError || data?.telegramLinked) {
    return null
  }

  const handleLinkNow = () => {
    router.push('/dashboard/telegram-bot#link')
  }

  const handleDismiss = () => {
    writeDismissed()
    setDismissed(true)
  }

  return (
    <div
      className="dc-telegram-banner"
      role="status"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '9px 18px',
        borderBottom: '1px solid var(--info-bd)',
        background: 'var(--info-soft)',
      }}
    >
      <span style={{ display: 'grid', placeItems: 'center', color: 'var(--info)', flex: 'none' }}>
        <DcIcon name="icon-send" size={14} />
      </span>
      <span
        style={{
          flex: 1,
          font: `500 12.5px/1.4 ${FONT}`,
          color: 'var(--ink-2)',
          textWrap: 'pretty',
        }}
      >
        <strong style={{ color: 'var(--ink)', fontWeight: 600 }}>Link your Telegram</strong>
        {' — '}
        login codes go to your personal chat, not a shared group.
      </span>
      <button
        type="button"
        onClick={handleLinkNow}
        style={{
          height: 28,
          padding: '0 12px',
          borderRadius: 8,
          border: '1px solid var(--info-bd)',
          background: 'transparent',
          color: 'var(--info)',
          font: `600 12px/1 ${FONT}`,
          cursor: 'pointer',
          flex: 'none',
        }}
      >
        Link now
      </button>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss — won’t show again"
        title="Dismiss"
        style={{
          display: 'grid',
          placeItems: 'center',
          width: 26,
          height: 26,
          borderRadius: 7,
          border: 0,
          background: 'transparent',
          color: 'var(--ink-3)',
          cursor: 'pointer',
          flex: 'none',
        }}
      >
        <DcIcon name="icon-x" size={14} />
      </button>
    </div>
  )
}
