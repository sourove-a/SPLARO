'use client'

import type { LucideIcon } from 'lucide-react'
import { Package, Plus, RefreshCw, Download, Search } from 'lucide-react'
import { AdminButton } from '@/components/ui/AdminButton'
import { cn } from '@/lib/utils/cn'

export type PremiumKpi = {
  label: string
  value: string | number
  accent?: string
  delta?: string
  deltaTone?: 'up' | 'down' | 'neutral'
}

export interface PremiumPanelShellProps {
  title: string
  icon?: LucideIcon
  action?: React.ReactNode
  kpis?: PremiumKpi[]
  /** Optional pipeline strip under KPIs */
  pipeline?: { label: string; count: string | number }[]
  query?: string
  onQuery?: (v: string) => void
  searchPlaceholder?: string
  tabs?: { key: string; label: string; count: number }[]
  activeTab?: string
  onTab?: (key: string) => void
  extraFilters?: React.ReactNode
  onRefresh?: () => void
  refreshing?: boolean
  onExport?: () => void
  exportDisabled?: boolean
  createLabel?: string
  onCreate?: () => void
  createDisabled?: boolean
  disabledActionTitle?: string
  tableTitle?: string
  tableIcon?: LucideIcon
  footer?: string
  liveStrip?: React.ReactNode
  alert?: React.ReactNode
  offlineBanner?: React.ReactNode
  children: React.ReactNode
  className?: string
}

function KpiCard({ label, value, accent, delta, deltaTone }: PremiumKpi) {
  return (
    <div className={cn('admin-kpi-card', accent && `admin-kpi-card--${accent}`)}>
      <p className="admin-kpi-card__label">{label}</p>
      <div className="admin-kpi-card__row">
        <p className="admin-kpi-card__value">{value}</p>
        {delta ? (
          <span className={cn('admin-kpi-card__delta', `admin-kpi-card__delta--${deltaTone ?? 'neutral'}`)}>
            {delta}
          </span>
        ) : null}
      </div>
    </div>
  )
}

/**
 * Shared Shadcn-like page rhythm: hero · KPI · toolbar · table.
 * Markup-only — callers own all data / mutations.
 */
export function PremiumPanelShell({
  title,
  icon: Icon = Package,
  action,
  kpis,
  pipeline,
  query,
  onQuery,
  searchPlaceholder = 'Search…',
  tabs,
  activeTab,
  onTab,
  extraFilters,
  onRefresh,
  refreshing = false,
  onExport,
  exportDisabled = false,
  createLabel,
  onCreate,
  createDisabled = false,
  disabledActionTitle,
  tableTitle,
  tableIcon: TableIcon = Package,
  footer,
  liveStrip,
  alert,
  offlineBanner,
  children,
  className,
}: PremiumPanelShellProps) {
  const showToolbar = onQuery || onRefresh || onExport || onCreate || tabs || extraFilters

  return (
    <div className={cn('admin-module-page admin-panel-page', className)}>
      {offlineBanner}
      {liveStrip ? <div className="admin-panel-page__live">{liveStrip}</div> : null}

      <div className="admin-catalog-hero admin-panel-hero">
        <div className="admin-catalog-hero__top">
          <div className="admin-catalog-hero__title-row">
            <div className="admin-catalog-icon-ring admin-catalog-icon-ring--lg">
              <Icon strokeWidth={2} />
            </div>
            <h1 className="admin-catalog-hero__title">{title}</h1>
          </div>
          <div className="admin-catalog-hero__actions">
            {action}
            {onCreate && !action ? (
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
                {createLabel ?? 'Create'}
              </button>
            ) : null}
          </div>
        </div>
        {kpis && kpis.length > 0 ? (
          <div className="admin-kpi-grid admin-kpi-grid--catalog">
            {kpis.map((k) => (
              <KpiCard key={k.label} {...k} />
            ))}
          </div>
        ) : null}
      </div>

      {alert}

      {pipeline && pipeline.length > 0 ? (
        <div className="admin-module-pipeline !grid-cols-5 mb-4">
          {pipeline.map((p) => (
            <div key={p.label} className="admin-module-pipeline__stage">
              <p className="admin-module-pipeline__count">{p.count}</p>
              <p className="admin-module-pipeline__label">{p.label}</p>
            </div>
          ))}
        </div>
      ) : null}

      {showToolbar ? (
        <div className="admin-catalog-toolbar">
          <div className="admin-catalog-toolbar__row">
            {onQuery ? (
              <div className="admin-catalog-toolbar__search">
                <Search className="admin-catalog-toolbar__search-icon" aria-hidden />
                <input
                  value={query ?? ''}
                  onChange={(e) => onQuery(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="admin-catalog-input"
                />
              </div>
            ) : null}
            {extraFilters}
            <div className="admin-catalog-toolbar__actions">
              {onRefresh ? (
                <AdminButton
                  variant="secondary"
                  onClick={onRefresh}
                  disabled={refreshing}
                  aria-busy={refreshing || undefined}
                  aria-label="Refresh data"
                >
                  <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} aria-hidden />
                  {refreshing ? 'Refreshing…' : 'Refresh'}
                </AdminButton>
              ) : null}
              {onExport ? (
                <AdminButton
                  variant="secondary"
                  onClick={onExport}
                  disabled={exportDisabled}
                  title={exportDisabled ? disabledActionTitle : undefined}
                >
                  <Download className="h-4 w-4" aria-hidden />
                  Export
                </AdminButton>
              ) : null}
              {onCreate && action ? (
                <AdminButton
                  variant="primary"
                  onClick={onCreate}
                  disabled={createDisabled}
                  title={createDisabled ? disabledActionTitle : undefined}
                >
                  <Plus className="h-4 w-4" aria-hidden />
                  {createLabel ?? 'Create'}
                </AdminButton>
              ) : null}
            </div>
          </div>
          {tabs && onTab ? (
            <div className="admin-catalog-toolbar__tabs" role="tablist">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === t.key}
                  onClick={() => onTab(t.key)}
                  className={cn('admin-catalog-tab', activeTab === t.key && 'admin-catalog-tab--active')}
                >
                  {t.label}
                  <span className="admin-catalog-tab__count">{t.count}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="admin-panel-glass admin-catalog-table-shell">
        {tableTitle ? (
          <div className="admin-catalog-table-shell__head">
            <div className="admin-catalog-icon-ring">
              <TableIcon aria-hidden />
            </div>
            <p className="admin-catalog-table-shell__title">{tableTitle}</p>
          </div>
        ) : null}
        <div className="admin-catalog-table-shell__scroll">{children}</div>
        {footer ? <div className="admin-catalog-table-shell__footer">{footer}</div> : null}
      </div>
    </div>
  )
}
