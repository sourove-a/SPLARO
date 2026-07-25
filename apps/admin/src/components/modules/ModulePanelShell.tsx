'use client'

import { useRef } from 'react'
import { Search, Plus, RefreshCw, Download } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { AdminButton } from '@/components/ui/AdminButton'
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
  /** When true, Refresh shows loading + spins icon + blocks duplicate clicks. */
  refreshing?: boolean
  /** Accessible name for the Refresh control (defaults to “Refresh data”). */
  refreshLabel?: string
  /** Optional fallback when table CSV export is unavailable — never use for fake success. */
  onExport?: () => void
  /** Disable create — no backend write path (shows honest tooltip, no fake toast). */
  createDisabled?: boolean
  /** Disable export — no backend or table export path. */
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
  /** Optional page title — when set, renders premium hero above KPIs */
  title?: string
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
  refreshing = false,
  refreshLabel = 'Refresh data',
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
    <div className="admin-panel-page min-w-0 space-y-4">
      {title ? (
        <div className="admin-catalog-hero admin-panel-hero !mb-0 !pb-4">
          <div className="admin-catalog-hero__top !mb-0">
            <div className="admin-catalog-hero__title-row">
              <div className="admin-catalog-icon-ring admin-catalog-icon-ring--lg">
                <TableIcon strokeWidth={2} />
              </div>
              <h1 className="admin-catalog-hero__title">{title}</h1>
            </div>
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
          </div>
        </div>
      ) : null}

      <div className="admin-kpi-grid admin-kpi-grid--catalog">
        {kpis.map(([label, value, tone], index) => (
          <div key={`${label}-${index}`} className={cn('admin-kpi-card', tone !== 'default' && `admin-kpi-card--${tone}`)}>
            <p className="admin-kpi-card__label">{label}</p>
            <div className="admin-kpi-card__row">
              <p className="admin-kpi-card__value">{value}</p>
            </div>
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

      <div className="admin-catalog-toolbar !mb-0">
        <div className="admin-catalog-toolbar__row">
          <div className="admin-catalog-toolbar__search">
            <Search className="admin-catalog-toolbar__search-icon" aria-hidden />
            <input
              value={query}
              onChange={(e) => onQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="admin-catalog-input"
            />
          </div>
          {extraFilters}
          <div className="admin-catalog-toolbar__actions">
            <AdminButton
              variant="secondary"
              onClick={handleRefresh}
              disabled={refreshing}
              aria-busy={refreshing || undefined}
              aria-label={refreshLabel}
              title={refreshLabel}
            >
              <RefreshCw className={cn('h-4 w-4 shrink-0', refreshing && 'animate-spin')} aria-hidden />
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </AdminButton>
            <AdminButton
              variant="secondary"
              onClick={handleExport}
              disabled={exportDisabled}
              title={exportDisabled ? disabledActionTitle : undefined}
            >
              <Download className="h-4 w-4" aria-hidden />
              Export
            </AdminButton>
            {!title ? (
              <AdminButton
                variant="primary"
                onClick={onCreate}
                disabled={createDisabled}
                title={createDisabled ? disabledActionTitle : undefined}
              >
                <Plus className="h-4 w-4" aria-hidden />
                {createLabel}
              </AdminButton>
            ) : null}
          </div>
        </div>
        {tabs && onTab ? (
          <div className="admin-catalog-toolbar__tabs" role="tablist">
            {tabs.map(({ key, label, count }) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={activeTab === key}
                onClick={() => onTab(key)}
                className={cn('admin-catalog-tab', activeTab === key && 'admin-catalog-tab--active')}
              >
                {label}
                <span className="admin-catalog-tab__count">{count}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="admin-catalog-table-shell">
        <div className="admin-catalog-table-shell__head">
          <div className="admin-catalog-icon-ring">
            <TableIcon aria-hidden />
          </div>
          <p className="admin-catalog-table-shell__title">{tableTitle}</p>
        </div>
        <div className="admin-catalog-table-shell__scroll overflow-x-auto" ref={tableWrapRef}>
          {children}
        </div>
        <div className="admin-catalog-table-shell__footer">
          <span>{footer}</span>
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
