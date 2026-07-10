'use client'

import { Send, X } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { useQuery } from '@tanstack/react-query'
import { useStaffTelegramLinkToken } from '@/lib/api/hooks'
import { fetchMyTelegramStatus } from '@/lib/api/security'
import { toastFail } from '@/lib/admin/feedback'

export function TelegramLinkBanner() {
  const [dismissed, setDismissed] = useState(false)
  const linkTelegram = useStaffTelegramLinkToken()
  const { data, isLoading } = useQuery({
    queryKey: ['my-telegram-status'],
    queryFn: fetchMyTelegramStatus,
    staleTime: 60_000,
    retry: 1,
  })

  if (dismissed || isLoading || data?.telegramLinked) {
    return null
  }

  const handleLink = () => {
    linkTelegram.mutate(undefined, {
      onSuccess: (res) => {
        toast.success(
          `${res.hint}\n\nCode: ${res.code} (expires in ${Math.round(res.expiresInSeconds / 60)} min)`,
          { duration: 20_000 },
        )
      },
      onError: (e) => toastFail(e instanceof Error ? e.message : 'Could not create link code.'),
    })
  }

  return (
    <div className="mx-4 mb-3 flex items-start justify-between gap-3 rounded-xl border border-amber-300/40 bg-amber-50/90 px-4 py-3 text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-100">
      <div className="min-w-0">
        <p className="text-sm font-extrabold">Link your Telegram to receive login codes</p>
        <p className="mt-1 text-xs font-semibold opacity-80">
          Login OTPs are sent only to your personal Telegram — not a shared group chat.
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={handleLink}
          disabled={linkTelegram.isPending}
          className="admin-btn admin-btn--primary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs"
        >
          <Send className="h-3.5 w-3.5" />
          Link Telegram
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="rounded-lg p-1 opacity-70 hover:bg-black/5 dark:hover:bg-white/10"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
