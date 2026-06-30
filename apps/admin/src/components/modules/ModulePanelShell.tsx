'use client'

import { useRef } from 'react'
import { Search, Plus, RefreshCw, Download } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { AdminButton } from '@/components/ui/AdminButton'
import { cn } from '@/lib/utils/cn'
import { exportTableFromContainer } from '@/lib/admin/admin-actions'

export interface ModulePanelShellProps {
  kpis: [string, string | number, string][]
  pipeline: [string, string | number][]
  query: string
  onQuery: (v: string) => void
  searchPlaceholder: string
  createLabel: string
  onCreate: () => void
  onRefresh: () => void
  /** Optional fallback when table CSV export is unavailable — never use for fake success. */
  onExport?: () => void
  tabs?: { key: string; label: string; count: number }[]
  activeTab?: string
  onTab?: (key: string) => void
  extraFilters?: React.ReactNode
  tableIcon: LucideIcon
  tableTitle: string
  footer: string
  exportSlug?: string
  children: React.ReactNode
}

export function ModulePanelShell({
  kpis,
  pipeline,
  query,
  onQuery,
  searchPlaceholder,
  createLabel,
  onCreate,
  onRefresh,
  onExport,
  tabs,
  activeTab,
  onTab,
  extraFilters,
  tableIcon: TableIcon,
  tableTitle,
  footer,
  exportSlug,
  children,
}: ModulePanelShellProps) {
  const tableWrapRef = useRef<HTMLDivElement>(null)

  const handleExport = () => {
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
    onRefresh()
  }
  return (
    <div className="min-w-0 space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map(([label, value, tone], index) => (
          <div key={`${label}-${index}`} className="admin-kpi rounded-[20px]">
            <p className="admin-kpi__label">{label}</p>
            <p className={`admin-kpi__value${tone !== 'default' ? ` admin-kpi__value--${tone}` : ''}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="admin-module-pipeline !grid-cols-5">
        {pipeline.map(([label, count], index) => (
          <div key={`${label}-${index}`} className="admin-module-pipeline__stage">
            <p className="admin-module-pipeline__count">{count}</p>
            <p className="admin-module-pipeline__label">{label}</p>
          </div>
        ))}
      </div>

      <div className="admin-module-toolbar">
        <div className="admin-search max-w-md min-w-[12rem] flex-1">
          <Search className="h-4 w-4" />
          <input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="flex-1 bg-transparent text-sm font-semibold text-[var(--admin-text)] outline-none placeholder:text-[var(--admin-text-muted)]"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <AdminButton onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </AdminButton>
          <AdminButton onClick={handleExport}>
            <Download className="h-4 w-4" />
            Export
          </AdminButton>
          <AdminButton variant="gold" onClick={onCreate}>
            <Plus className="h-4 w-4" />
            {createLabel}
          </AdminButton>
        </div>
      </div>

      {tabs && onTab ? (
        <div className="admin-module-tabs">
          {tabs.map(({ key, label, count }) => (
            <button
              key={key}
              type="button"
              onClick={() => onTab(key)}
              className={cn('admin-module-tab', activeTab === key && 'admin-module-tab--active')}
            >
              {label}
              <span className="admin-module-tab__count">{count}</span>
            </button>
          ))}
        </div>
      ) : null}

      {extraFilters}

      <div className="admin-module-table-wrap">
        <div className="admin-module-table-head">
          <TableIcon className="h-4 w-4 text-[#5E7CFF]" />
          <p className="admin-kpi__label !mb-0">{tableTitle}</p>
        </div>
        <div className="overflow-x-auto" ref={tableWrapRef}>{children}</div>
        <div className="admin-module-table-foot">
          <span>{footer}</span>
          <span className="tabular-nums">Page 1 of 1</span>
        </div>
      </div>
    </div>
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
