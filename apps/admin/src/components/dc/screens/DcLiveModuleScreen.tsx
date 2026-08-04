'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'

import { DcPageHead } from '@/components/dc/DcPageHead'
import { DcScreenProvider } from '@/components/dc/DcScreenContext'
import { DcSoftLockPanel } from '@/components/dc/DcSoftLockPanel'
import { dcConnectionChip } from '@/components/dc/page-status'
import { metaForScreen } from '@/components/dc/screens'
import { useAdminConnection } from '@/lib/hooks/use-admin-connection'
import type { FlatAdminRoute } from '@/lib/navigation/admin-nav'

/**
 * DC chrome for legacy screen keys — soft-lock, since the old panel bodies are gone.
 */
export function DcLiveModuleScreen({
  screen,
  moduleHref: _moduleHref,
  navItem,
  fallbackTitle,
}: {
  screen: string
  moduleHref: string
  navItem: FlatAdminRoute
  fallbackTitle?: string
}) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { api } = useAdminConnection(25_000)
  const meta = metaForScreen(screen)
  const title = meta?.title ?? fallbackTitle ?? navItem.label

  const conn = dcConnectionChip(api.pulse)
  // Always soft-locks — never show LIVE/BETA maturity as if the panel were wired.
  const status = conn ?? { label: 'SOFT' as const, tone: 'mute' as const }

  return (
    <DcScreenProvider
      screen={screen}
      onNavigate={(next) => {
        router.push(next.startsWith('/') ? next : `/dashboard/${next}`)
      }}
    >
      <DcPageHead
        crumbGroup={meta?.group ?? navItem.group}
        title={title}
        statusLabel={status.label}
        statusTone={status.tone}
        syncLabel="Not in primary DC nav — use sidebar screens"
        onSync={() => {
          void queryClient.invalidateQueries()
          router.refresh()
        }}
        {...(meta?.back
          ? {
              onBack: () => {
                const back = meta.back!.startsWith('/') ? meta.back! : `/dashboard/${meta.back}`
                router.push(back)
              },
            }
          : {})}
      />
      <div className={`dc-detail-host dc-live-module dc-live-module--${screen}`} data-dc-screen={screen}>
        <DcSoftLockPanel title={title} href="/dashboard" />
      </div>
    </DcScreenProvider>
  )
}
