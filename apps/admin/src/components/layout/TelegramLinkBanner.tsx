'use client'

import { Send, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useStaffTelegramLinkToken } from '@/lib/api/hooks'
import { fetchMyTelegramStatus } from '@/lib/api/security'
import { confirmTelegramLinkTokenGenerated } from '@/lib/admin/security-save'

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

export function TelegramLinkBanner() {
  /** null = hydrating (avoid flash); start hidden until we know */
  const [dismissed, setDismissed] = useState<boolean | null>(null)
  const linkTelegram = useStaffTelegramLinkToken()
  const qc = useQueryClient()
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

  // Hide while hydrating / loading; don't re-flash on query error
  if (dismissed === null || dismissed || isLoading || isError || data?.telegramLinked) {
    return null
  }

  const handleLink = async () => {
    writeDismissed()
    setDismissed(true)
    const token = await confirmTelegramLinkTokenGenerated(
      () => linkTelegram.mutateAsync(undefined),
      'tg-staff-link',
    )
    if (token) {
      void qc.invalidateQueries({ queryKey: ['my-telegram-status'] })
      void qc.invalidateQueries({ queryKey: ['platform-security'] })
    }
  }

  const handleDismiss = () => {
    writeDismissed()
    setDismissed(true)
  }

  return (
    <div
      className="telegram-link-banner mx-4 mb-3 flex items-start justify-between gap-3 px-4 py-3"
      role="status"
    >
      <div className="min-w-0">
        <p className="text-sm font-extrabold text-[var(--admin-text)]">
          Link your Telegram to receive login codes
        </p>
        <p className="mt-1 text-xs font-semibold text-[var(--admin-text-secondary)]">
          Login OTPs are sent only to your personal Telegram — not a shared group chat.
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={() => void handleLink()}
          disabled={linkTelegram.isPending}
          className="admin-btn admin-btn--primary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs"
        >
          <Send className="h-3.5 w-3.5" />
          {linkTelegram.isPending ? 'Generating…' : 'Link Telegram'}
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          className="telegram-link-banner__close rounded-lg p-1.5"
          aria-label="Dismiss — won’t show again"
          title="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
