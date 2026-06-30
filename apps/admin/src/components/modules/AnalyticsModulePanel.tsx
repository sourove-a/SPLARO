'use client'

import { useMemo, useState } from 'react'
import { BarChart3, RefreshCw, TrendingDown, TrendingUp } from 'lucide-react'
import { SalesChart } from '@/components/analytics/SalesChart'
import { useDashboardStats, useOrders } from '@/lib/api/hooks'
import { formatBDT } from '@/lib/utils/currency'

// ─── Design tokens ──────────────────────────────────────────────────────────
const GOLD = '#5E7CFF'
const GOLD_LIGHT = 'rgba(200,169,126,0.10)'
const GOLD_BORDER = 'rgba(200,169,126,0.32)'


const PERIODS = ['Today', '7 Days', '30 Days'] as const

const STATUS_BADGE: Record<string, { bg: string; text: string; border: string }> = {
  PENDING:    { bg: 'rgba(245,158,11,0.10)', text: '#B45309', border: 'rgba(245,158,11,0.30)' },
  PROCESSING: { bg: 'rgba(59,130,246,0.10)', text: '#1D4ED8', border: 'rgba(59,130,246,0.30)' },
  SHIPPED:    { bg: 'rgba(139,92,246,0.10)', text: '#6D28D9', border: 'rgba(139,92,246,0.30)' },
  DELIVERED:  { bg: 'rgba(22,163,74,0.10)',  text: '#15803D', border: 'rgba(22,163,74,0.30)' },
  CANCELLED:  { bg: 'rgba(239,68,68,0.10)',  text: '#B91C1C', border: 'rgba(239,68,68,0.30)' },
  RETURNED:   { bg: 'rgba(156,163,175,0.10)', text: '#4B5563', border: 'rgba(156,163,175,0.30)' },
}

function StatusBadge({ status }: { status: string }) {
  const fallback = { bg: 'rgba(245,158,11,0.10)', text: '#B45309', border: 'rgba(245,158,11,0.30)' }
  const s = STATUS_BADGE[status] ?? fallback
  return (
    <span style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.text, borderRadius: 8, padding: '2px 10px', fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap' }}>
      {status.toLowerCase()}
    </span>
  )
}

function KpiCard({ label, value, accent, change }: { label: string; value: string | number; accent?: string; change?: number }) {
  const accentColor = accent === 'gold' ? GOLD : accent === 'success' ? '#16A34A' : accent === 'warning' ? '#D97706' : '#6366F1'
  const accentBg = accent === 'gold' ? GOLD_LIGHT : accent === 'success' ? 'rgba(22,163,74,0.08)' : accent === 'warning' ? 'rgba(217,119,6,0.08)' : 'rgba(99,102,241,0.08)'

  return (
    <div className="settings-card admin-panel-glass-subtle" style={{ padding: '18px 20px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${accentColor}60, transparent)` }} />
      <div style={{ width: 32, height: 32, borderRadius: 9, background: accentBg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: accentColor }} />
      </div>
      <p style={{ fontSize: 22, fontWeight: 900, color: 'var(--admin-text-primary)', lineHeight: 1, margin: 0 }}>{value}</p>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--admin-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>{label}</p>
        {change !== undefined && change !== 0 && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 11, fontWeight: 800, color: change > 0 ? '#15803D' : '#B91C1C' }}>
            {change > 0 ? <TrendingUp style={{ width: 11, height: 11 }} /> : <TrendingDown style={{ width: 11, height: 11 }} />}
            {Math.abs(change)}%
          </span>
        )}
      </div>
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

  if (isError) return (
    <div className="settings-card admin-panel-glass" style={{ padding: 24, borderLeft: '3px solid #EF4444', color: '#B91C1C', fontSize: 13, fontWeight: 700 }}>
      Analytics API offline — start pnpm dev:api
    </div>
  )

  if (isLoading || !stats) {
    return (
      <div className="settings-card admin-panel-glass" style={{ padding: 24, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontWeight: 600, color: 'var(--admin-text-muted)' }}>
        <RefreshCw style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} />
        Loading analytics…
      </div>
    )
  }

  return (
    <div className="settings-section-enter" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header + period picker + primary KPIs */}
      <div className="settings-card admin-panel-glass" style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: GOLD_LIGHT, border: `1px solid ${GOLD_BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BarChart3 style={{ width: 18, height: 18, color: GOLD }} strokeWidth={2} />
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 900, color: 'var(--admin-text-primary)', margin: 0 }}>Analytics Overview</h3>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {PERIODS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                style={{
                  background: period === p ? GOLD_LIGHT : 'rgba(255,255,255,0.7)',
                  border: `1px solid ${period === p ? GOLD_BORDER : 'rgba(255,255,255,0.8)'}`,
                  color: period === p ? '#8B6914' : 'var(--admin-text-secondary)',
                  borderRadius: 9, padding: '6px 14px', fontSize: 12, fontWeight: 800, cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          <KpiCard label="Revenue" value={formatBDT(stats.revenue.value)} accent="gold" change={stats.revenue.change} />
          <KpiCard label="Orders" value={stats.orders.value} accent="default" change={stats.orders.change} />
          <KpiCard label="Customers" value={stats.customers.value} accent="success" change={stats.customers.change} />
          <KpiCard label="AOV" value={formatBDT(stats.avgOrderValue.value)} accent="warning" />
        </div>
      </div>

      {/* Delta + alerts strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {([
          ['Revenue Δ', stats.revenue.change !== 0 ? `${stats.revenue.change > 0 ? '+' : ''}${stats.revenue.change}%` : '—', 'gold'],
          ['Orders Δ', stats.orders.change !== 0 ? `${stats.orders.change > 0 ? '+' : ''}${stats.orders.change}%` : '—', 'default'],
          ['Customers Δ', stats.customers.change !== 0 ? `${stats.customers.change > 0 ? '+' : ''}${stats.customers.change}%` : '—', 'success'],
          ['COD risk orders', stats.alerts.codRiskOrders, 'warning'],
        ] as [string, string | number, string][]).map(([label, value, accent]) => (
          <KpiCard key={label} label={label} value={value} accent={accent} />
        ))}
      </div>

      {/* Sales chart */}
      <div className="settings-card admin-panel-glass" style={{ padding: 24 }}>
        <SalesChart period={period} title="Revenue trend" subtitle="From live finance API" />
      </div>

      {/* Order status mix */}
      <div className="settings-card admin-panel-glass" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: GOLD_LIGHT, border: `1px solid ${GOLD_BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BarChart3 style={{ width: 14, height: 14, color: GOLD }} />
          </div>
          <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--admin-text-primary)', margin: 0 }}>
            Order status mix <span style={{ color: 'var(--admin-text-muted)', fontWeight: 600 }}>(recent 100)</span>
          </p>
        </div>
        {statusBreakdown.length === 0 ? (
          <p style={{ padding: 24, fontSize: 13, fontWeight: 600, color: 'var(--admin-text-muted)' }}>No orders yet.</p>
        ) : (
          <div style={{ padding: '12px 24px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {statusBreakdown.map(([status, count]) => {
              const maxCount = statusBreakdown[0]?.[1] ?? 1
              const pct = Math.round((count / maxCount) * 100)
              return (
                <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 110, flexShrink: 0 }}>
                    <StatusBadge status={status} />
                  </div>
                  <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'rgba(200,169,126,0.12)', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', borderRadius: 3, background: `linear-gradient(90deg, ${GOLD}, rgba(200,169,126,0.4))`, transition: 'width 0.4s ease' }} />
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 900, color: 'var(--admin-text-primary)', minWidth: 28, textAlign: 'right' }}>{count}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
