'use client'

import { useRef } from 'react'
import { Plus } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { PremiumPanelShell } from '@/components/ui/PremiumPanelShell'
import { cn } from '@/lib/utils/cn'
import { exportTableFromContainer } from '@/lib/admin/admin-actions'
import { BACKEND_NOT_CONNECTED_TITLE } from '@/lib/admin/feedback'

export interface ModulePanelShellProps {
  kpis: [string, string | number, string][]
  pipeline: [string, string | number][]
  query: string
  onQuery: (v: string) => void
  searchPlaceholder: string
  createLabel: string
  onCreate: () => void
  onRefresh: () => void | Promise<void>
  refreshing?: boolean
  refreshLabel?: string
  onExport?: () => void
  createDisabled?: boolean
  exportDisabled?: boolean
  disabledActionTitle?: string
  tabs?: { key: string; label: string; count: number }[]
  activeTab?: string
  onTab?: (key: string) => void
  extraFilters?: React.ReactNode
  tableIcon: LucideIcon
  tableTitle: string
  footer: string
  exportSlug?: string
  title?: string
  children: React.ReactNode
}

/**
 * Legacy tuple API — single chrome via PremiumPanelShell.
 */
export function ModulePanelShell({
  kpis,
  pipeline,
  query,
  onQuery,
  searchPlaceholder,
  createLabel,
  onCreate,
  onRefresh,
  refreshing = false,
  onExport,
  createDisabled = false,
  exportDisabled = false,
  disabledActionTitle = BACKEND_NOT_CONNECTED_TITLE,
  tabs,
  activeTab,
  onTab,
  extraFilters,
  tableIcon: TableIcon,
  tableTitle,
  footer,
  exportSlug,
  title,
  children,
}: ModulePanelShellProps) {
  const tableWrapRef = useRef<HTMLDivElement>(null)

  const handleExport = () => {
    if (exportDisabled) return
    const slug =
      exportSlug ??
      (tableTitle
        .replace(/·.*/g, '')
        .trim()
        .replace(/[^a-z0-9]+/gi, '-')
        .toLowerCase() || 'export')
    const ok = exportTableFromContainer(tableWrapRef.current, slug)
    if (!ok && onExport) onExport()
  }

  const handleRefresh = () => {
    if (refreshing) return
    void onRefresh()
  }

  return (
    <PremiumPanelShell
      title={title ?? tableTitle}
      icon={TableIcon}
      kpis={kpis.map(([label, value, accent]) => ({
        label,
        value,
        ...(accent && accent !== 'default' ? { accent } : {}),
      }))}
      pipeline={pipeline.map(([label, count]) => ({ label, count }))}
      query={query}
      onQuery={onQuery}
      searchPlaceholder={searchPlaceholder}
      createLabel={createLabel}
      onCreate={onCreate}
      createDisabled={createDisabled}
      disabledActionTitle={disabledActionTitle}
      onRefresh={handleRefresh}
      refreshing={refreshing}
      onExport={handleExport}
      exportDisabled={exportDisabled}
      tableTitle={tableTitle}
      tableIcon={TableIcon}
      footer={footer}
      {...(tabs ? { tabs } : {})}
      {...(activeTab !== undefined ? { activeTab } : {})}
      {...(onTab ? { onTab } : {})}
      {...(extraFilters !== undefined ? { extraFilters } : {})}
      {...(title
        ? {
            action: (
              <button
                type="button"
                className={cn(
                  'admin-catalog-action admin-catalog-action--primary admin-catalog-action--lg',
                  createDisabled && 'cursor-not-allowed opacity-50',
                )}
                disabled={createDisabled}
                title={createDisabled ? disabledActionTitle : undefined}
                onClick={() => {
                  if (!createDisabled) onCreate()
                }}
              >
                <Plus className="h-4 w-4" aria-hidden />
                {createLabel}
              </button>
            ),
          }
        : {})}
    >
      <div ref={tableWrapRef}>{children}</div>
    </PremiumPanelShell>
  )
}

export const STATUS_CLASS: Record<string, string> = {
  pending: 'admin-status admin-status--pending',
  processing: 'admin-status admin-status--processing',
  approved: 'admin-status admin-status--shipped',
  received: 'admin-status admin-status--shipped',
  refunded: 'admin-status admin-status--delivered',
  rejected: 'admin-status admin-status--pending',
  active: 'admin-status admin-status--delivered',
  paused: 'admin-status admin-status--processing',
  cancelled: 'admin-status admin-status--pending',
  draft: 'admin-status admin-status--processing',
  sent: 'admin-status admin-status--shipped',
  delivered: 'admin-status admin-status--delivered',
  paid: 'admin-status admin-status--delivered',
  overdue: 'admin-status admin-status--pending',
  success: 'admin-status admin-status--delivered',
  failed: 'admin-status admin-status--failed',
  archived: 'admin-status admin-status--shipped',
  low: 'admin-status admin-status--pending',
  published: 'admin-status admin-status--delivered',
  hidden: 'admin-status admin-status--processing',
}

export function formatBDT(n: number) {
  return `৳${n.toLocaleString('en-BD')}`
}
