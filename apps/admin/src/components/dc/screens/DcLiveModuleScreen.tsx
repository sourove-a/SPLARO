'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'

import { DcPageHead } from '@/components/dc/DcPageHead'
import { DcScreenProvider } from '@/components/dc/DcScreenContext'
import { dcConnectionChip } from '@/components/dc/page-status'
import { metaForScreen } from '@/components/dc/screens'
import { ModuleWorkspace } from '@/components/modules/ModuleWorkspace'
import { useAdminConnection } from '@/lib/hooks/use-admin-connection'
import type { FlatAdminRoute } from '@/lib/navigation/admin-nav'
import { getModuleMaturity } from '@/lib/modules/module-maturity'

/**
 * DC chrome + live ModuleWorkspace body.
 * Status chip reflects connection + module maturity — beta/prototype never claim LIVE.
 */
export function DcLiveModuleScreen({
  screen,
  moduleHref,
  navItem,
  subPath,
  fallbackTitle,
}: {
  screen: string
  moduleHref: string
  navItem: FlatAdminRoute
  subPath?: string[]
  fallbackTitle?: string
}) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { api } = useAdminConnection(25_000)
  const meta = metaForScreen(screen)
  const maturity = getModuleMaturity(moduleHref)
  const title = meta?.title ?? fallbackTitle ?? navItem.label

  const conn = dcConnectionChip(api.pulse)
  const status =
    conn ??
    (maturity === 'live'
      ? { label: 'LIVE' as const, tone: 'ok' as const }
      : maturity === 'beta'
        ? { label: 'BETA' as const, tone: 'warn' as const }
        : { label: 'PREVIEW' as const, tone: 'mute' as const })

  const syncLabel =
    api.pulse === 'offline'
      ? 'API offline — panel may be empty'
      : api.pulse === 'degraded'
        ? 'Platform degraded — some services may fail'
        : maturity === 'live'
          ? api.latencyMs != null
            ? `API · ${api.latencyMs}ms · live panel`
            : 'Live module panel · verified API only'
          : maturity === 'beta'
            ? 'Beta — some writes locked until APIs ship'
            : 'Preview shell — no verified write path'

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
        syncLabel={syncLabel}
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
      <div
        className={`dc-detail-host dc-live-module dc-live-module--${screen}`}
        data-dc-screen={screen}
      >
        <ModuleWorkspace
          key={`${moduleHref}-${(subPath ?? []).join('/')}`}
          navItem={navItem}
          moduleHref={moduleHref}
          {...(subPath && subPath.length > 0 ? { subPath } : {})}
        />
      </div>
    </DcScreenProvider>
  )
}
