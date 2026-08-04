'use client'

import type { ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'

import { DcPageHead } from '@/components/dc/DcPageHead'
import { DcScreenProvider } from '@/components/dc/DcScreenContext'
import { DcSoftLockPanel } from '@/components/dc/DcSoftLockPanel'
import { dcConnectionChip } from '@/components/dc/page-status'
import { useAdminConnection } from '@/lib/hooks/use-admin-connection'
import type { FlatAdminRoute } from '@/lib/navigation/admin-nav'
import { getModuleMaturity } from '@/lib/modules/module-maturity'

/**
 * Universal DC chrome. Custom children (footwear, stubs) render as-is.
 * Everything else soft-locks — the pre-DC panel bodies are retired.
 */
export function DcModuleHost({
  navItem,
  moduleHref,
  action,
  title,
  screen = 'module',
  crumbGroup,
  children,
  showBack,
  softLockHint,
  softLockHref,
}: {
  navItem: FlatAdminRoute
  moduleHref: string
  action?: 'create' | 'edit' | 'detail' | null
  title?: string
  screen?: string
  crumbGroup?: string
  children?: ReactNode
  showBack?: boolean
  softLockHint?: string
  softLockHref?: string
}) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { api } = useAdminConnection(25_000)
  const maturity = getModuleMaturity(moduleHref)
  const pageTitle = title ?? navItem.label
  const back = showBack ?? Boolean(action)

  const conn = dcConnectionChip(api.pulse)
  // Soft-locked body talks to no API — never claim LIVE (maturity may still say live for legacy hrefs).
  const softLocked = !children
  const status =
    conn ??
    (softLocked
      ? { label: 'SOFT' as const, tone: 'mute' as const }
      : maturity === 'live'
        ? { label: 'LIVE' as const, tone: 'ok' as const }
        : maturity === 'beta'
          ? { label: 'BETA' as const, tone: 'warn' as const }
          : { label: 'PREVIEW' as const, tone: 'mute' as const })

  // A soft-locked body talks to no API, so never claim a verified panel there.
  const syncLabel = children
    ? api.pulse === 'offline'
      ? 'API offline — panel may be empty'
      : api.latencyMs != null
        ? `API · ${api.latencyMs}ms`
        : 'Verified API panel'
    : 'Not in primary DC nav — use sidebar screens'

  return (
    <DcScreenProvider
      screen={screen}
      onNavigate={(next) => {
        router.push(next.startsWith('/') ? next : `/dashboard/${next}`)
      }}
    >
      <DcPageHead
        crumbGroup={crumbGroup ?? navItem.group}
        title={pageTitle}
        statusLabel={status.label}
        statusTone={status.tone}
        syncLabel={syncLabel}
        onSync={() => {
          void queryClient.invalidateQueries()
          router.refresh()
        }}
        {...(back
          ? {
              onBack: () => {
                router.push(moduleHref)
              },
            }
          : {})}
      />
      <div
        className={`dc-detail-host dc-live-module dc-live-module--${screen}`}
        data-dc-screen={screen}
      >
        {children ?? (
          <DcSoftLockPanel
            title={pageTitle}
            href={softLockHref ?? '/dashboard'}
            {...(softLockHint ? { hint: softLockHint } : {})}
          />
        )}
      </div>
    </DcScreenProvider>
  )
}
