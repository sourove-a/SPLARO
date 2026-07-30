'use client'

import type { ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'

import { DcPageHead } from '@/components/dc/DcPageHead'
import { DcScreenProvider } from '@/components/dc/DcScreenContext'
import { dcConnectionChip } from '@/components/dc/page-status'
import { ModuleWorkspace } from '@/components/modules/ModuleWorkspace'
import { useAdminConnection } from '@/lib/hooks/use-admin-connection'
import type { FlatAdminRoute } from '@/lib/navigation/admin-nav'
import { getModuleMaturity } from '@/lib/modules/module-maturity'

/**
 * Universal DC chrome for any live ModuleWorkspace (or custom children).
 * Replaces AdminPageShell so list / create / detail share one page head.
 */
export function DcModuleHost({
  navItem,
  moduleHref,
  subPath,
  action,
  title,
  screen = 'module',
  crumbGroup,
  children,
  showBack,
}: {
  navItem: FlatAdminRoute
  moduleHref: string
  subPath?: string[]
  action?: 'create' | 'edit' | 'detail' | null
  title?: string
  screen?: string
  crumbGroup?: string
  children?: ReactNode
  /** Force back control; defaults to true when action is set. */
  showBack?: boolean
}) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { api } = useAdminConnection(25_000)
  const maturity = getModuleMaturity(moduleHref)
  const pageTitle = title ?? navItem.label
  const back = showBack ?? Boolean(action)

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
          <ModuleWorkspace
            key={`${moduleHref}-${(subPath ?? []).join('/')}-${action ?? 'list'}`}
            navItem={navItem}
            moduleHref={moduleHref}
            {...(subPath && subPath.length > 0 ? { subPath } : {})}
            {...(action ? { action } : {})}
          />
        )}
      </div>
    </DcScreenProvider>
  )
}
