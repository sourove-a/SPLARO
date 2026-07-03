'use client'

import { useMemo, useState } from 'react'
import { BarChart3, RefreshCw, TrendingDown, TrendingUp } from 'lucide-react'
import { SalesChart } from '@/components/analytics/SalesChart'
import { useDashboardStats, useOrders } from '@/lib/api/hooks'
import { formatBDT } from '@/lib/utils/currency'
import { cn } from '@/lib/utils/cn'

const PERIODS = ['Today', '7 Days', '30 Days'] as const

const STATUS_BADGE: Record<string, string> = {
  PENDING: 'analytics-badge analytics-badge--pending',
  PROCESSING: 'analytics-badge analytics-badge--processing',
  SHIPPED: 'analytics-badge analytics-badge--shipped',
  DELIVERED: 'analytics-badge analytics-badge--delivered',
  CANCELLED: 'analytics-badge analytics-badge--cancelled',
  RETURNED: 'analytics-badge analytics-badge--returned',
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={STATUS_BADGE[status] ?? 'analytics-badge analytics-badge--pending'}>
      {status.toLowerCase()}
    </span>
  )
}

function KpiCard({
  label,
  value,
  accent = 'default',
  change,
}: {
  label: string
  value: string | number
  accent?: 'default' | 'gold' | 'success' | 'warning'
  change?: number
}) {
  return (
    <div className={cn('admin-kpi analytics-kpi', accent === 'gold' && 'admin-kpi--gold')}>
      <p className="admin-kpi__label">{label}</p>
      <p className="admin-kpi__value">{value}</p>
      {change !== undefined && change !== 0 ? (
        <p className={cn('mt-1 flex items-center gap-1 text-xs font-bold', change > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
          {change > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {Math.abs(change)}%
        </p>
      ) : null}
    </div>
  )
}

export function AnalyticsModulePanel() {
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>('7 Days')
  const { data: stats, isLoading, isError } = useDashboardStats(period)
  const { data: ordersData } = useOrders({ limit: 100 })

  const statusBreakdown = useMemo(() => {
    const map = new Map<string, number>()
    for (const o of ordersData?.orders ?? []) {
      map.set(o.status, (map.get(o.status) ?? 0) + 1)
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1])
  }, [ordersData?.orders])

  if (isError) {
    return (
      <div className="admin-module-card border-red-300/40 bg-red-50/80 p-6 text-sm font-bold text-red-700 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300">
        Analytics API offline — start pnpm dev:api
      </div>
    )
  }

  if (isLoading || !stats) {
    return (
      <div className="admin-module-card flex items-center gap-2.5 p-6 text-sm font-semibold text-[var(--admin-text-muted)]">
        <RefreshCw className="h-4 w-4 animate-spin" />
        Loading analytics…
      </div>
    )
  }

  return (
    <div className="analytics-panel">
      <div className="admin-module-card p-5 sm:p-6">
        <div className="analytics-panel__header">
          <div className="analytics-panel__title-wrap">
            <div className="analytics-panel__icon">
              <BarChart3 className="h-[18px] w-[18px]" strokeWidth={2} />
            </div>
            <h3 className="text-base font-black text-[var(--admin-text)]">Analytics Overview</h3>
          </div>
          <div className="analytics-periods">
            {PERIODS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={cn('analytics-period-btn', period === p && 'analytics-period-btn--active')}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
        <div className="analytics-kpi-grid">
          <KpiCard label="Revenue" value={formatBDT(stats.revenue.value)} accent="gold" change={stats.revenue.change} />
          <KpiCard label="Orders" value={stats.orders.value} change={stats.orders.change} />
          <KpiCard label="Customers" value={stats.customers.value} accent="success" change={stats.customers.change} />
          <KpiCard label="AOV" value={formatBDT(stats.avgOrderValue.value)} accent="warning" />
        </div>
      </div>

      <div className="analytics-kpi-grid">
        {(
          [
            ['Revenue Δ', stats.revenue.change !== 0 ? `${stats.revenue.change > 0 ? '+' : ''}${stats.revenue.change}%` : '—', 'gold'],
            ['Orders Δ', stats.orders.change !== 0 ? `${stats.orders.change > 0 ? '+' : ''}${stats.orders.change}%` : '—', 'default'],
            ['Customers Δ', stats.customers.change !== 0 ? `${stats.customers.change > 0 ? '+' : ''}${stats.customers.change}%` : '—', 'success'],
            ['COD risk orders', stats.alerts.codRiskOrders, 'warning'],
          ] as const
        ).map(([label, value, accent]) => (
          <KpiCard key={label} label={label} value={value} accent={accent} />
        ))}
      </div>

      <SalesChart period={period} title="Revenue trend" subtitle="From live finance API" />

      <div className="admin-module-card overflow-hidden p-0">
        <div className="analytics-status-head">
          <div className="analytics-panel__icon">
            <BarChart3 className="h-3.5 w-3.5" />
          </div>
          <p className="text-sm font-extrabold text-[var(--admin-text)]">
            Order status mix{' '}
            <span className="font-semibold text-[var(--admin-text-muted)]">(recent 100)</span>
          </p>
        </div>
        {statusBreakdown.length === 0 ? (
          <p className="px-6 py-5 text-sm font-semibold text-[var(--admin-text-muted)]">No orders yet.</p>
        ) : (
          <div className="analytics-status-body">
            {statusBreakdown.map(([status, count]) => {
              const maxCount = statusBreakdown[0]?.[1] ?? 1
              const pct = Math.round((count / maxCount) * 100)
              return (
                <div key={status} className="analytics-status-row">
                  <div className="w-[7rem] shrink-0">
                    <StatusBadge status={status} />
                  </div>
                  <div className="analytics-status-bar">
                    <div className="analytics-status-bar__fill" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="min-w-[1.75rem] text-right text-sm font-black text-[var(--admin-text)]">{count}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
