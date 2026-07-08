'use client'

import { AlertTriangle, ArrowLeft } from 'lucide-react'
import { AdminLinkButton } from '@/components/ui/AdminButton'
import { AdminBackendMissingAlert, AdminWarningAlert } from '@/components/ui/AdminUiPrimitives'
import { getModuleMaturityMeta } from '@/lib/modules/module-maturity'

export type BackendMissingMode = 'create' | 'detail' | 'edit'

interface BackendNotConnectedViewProps {
  moduleLabel: string
  moduleHref: string
  title: string
  mode: BackendMissingMode
  recordId?: string
}

const MODE_COPY: Record<BackendMissingMode, { headline: string; body: string }> = {
  create: {
    headline: 'Backend not connected for this action',
    body: 'Connect API before enabling this workflow. This screen cannot create records on the server yet — no data will be saved.',
  },
  detail: {
    headline: 'This screen is read-only until API endpoint is added',
    body: 'This record cannot be loaded from the backend. Open the module list for live data from connected modules.',
  },
  edit: {
    headline: 'Backend not connected for this action',
    body: 'This screen is read-only until an edit API endpoint is added. No data was saved and nothing can be changed here.',
  },
}

export function BackendNotConnectedView({
  moduleLabel,
  moduleHref,
  title,
  mode,
  recordId,
}: BackendNotConnectedViewProps) {
  const maturity = getModuleMaturityMeta(moduleHref)
  const copy = MODE_COPY[mode]

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <AdminBackendMissingAlert headline={copy.headline} body={copy.body} />

      <div className="admin-module-card space-y-4">
        <AdminWarningAlert
          headline={`${maturity.label}${moduleLabel ? ` · ${moduleLabel}` : ''}`}
          body={maturity.hint}
        />

        <div>
          <p className="admin-kpi__label">{moduleLabel}</p>
          <h2 className="mt-1 text-base font-extrabold text-[var(--admin-text)]">{title}</h2>
          {recordId ? (
            <p className="mt-1 font-mono text-xs font-semibold text-[var(--admin-text-muted)]">
              Reference: {recordId}
            </p>
          ) : null}
        </div>

        <div className="admin-blocked-panel">
          <AlertTriangle className="mx-auto h-4 w-4 text-amber-700 dark:text-amber-300" aria-hidden />
          <p className="mt-2 text-sm font-bold text-[var(--admin-text-secondary)]">No editable fields</p>
          <p className="mx-auto mt-1 max-w-sm text-xs font-semibold text-[var(--admin-text-muted)]">
            Connect API before enabling this workflow. Submit and save are disabled.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <AdminLinkButton href={moduleHref} variant="gold">
            <ArrowLeft className="h-4 w-4" />
            Back to {moduleLabel}
          </AdminLinkButton>
          <AdminLinkButton href="/dashboard" variant="ghost">
            Dashboard
          </AdminLinkButton>
        </div>
      </div>
    </div>
  )
}
