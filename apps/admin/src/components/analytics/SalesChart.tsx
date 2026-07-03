'use client'

import { useEffect, useState } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { formatBDT } from '@/lib/utils/currency'
import { fetchProfitLoss } from '@/lib/api/finance'

interface ChartDataPoint {
  label: string
  revenue: number
}

interface ProfitLossResponse {
  totals?: { grossRevenue?: number; netProfit?: number }
  timeline?: Array<{ label: string; revenue: number }>
  orderCount?: number
}

interface SalesChartProps {
  period?: string
  title?: string
  subtitle?: string
  compact?: boolean
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { value: number; dataKey: string }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="admin-chart-tooltip">
      <p className="admin-chart-tooltip__label">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="admin-chart-tooltip__value">
          {formatBDT(p.value)}
        </p>
      ))}
    </div>
  )
}

function periodToPlLabel(period: string): 'daily' | 'weekly' | 'monthly' | 'yearly' {
  if (period === 'Today') return 'daily'
  if (period === '7 Days') return 'weekly'
  if (period === 'Quarter') return 'yearly'
  return 'monthly'
}

export function SalesChart({
  period = '30 Days',
  title = 'Revenue Overview',
  subtitle,
  compact = false,
}: SalesChartProps) {
  const [data, setData] = useState<ChartDataPoint[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setOffline(false)

    fetchProfitLoss(periodToPlLabel(period))
      .then((res) => {
        if (cancelled) return
        const summary = res as ProfitLossResponse
        const revenue = summary.totals?.grossRevenue ?? 0
        setTotal(revenue)

        // Only chart the real timeline from the API. The old fallback drew a
        // pseudo-random daily split of the total, which looked like data but
        // was invented — better an honest empty state.
        setData(Array.isArray(summary.timeline) && summary.timeline.length > 0 ? summary.timeline : [])
      })
      .catch(() => {
        if (cancelled) return
        setOffline(true)
        setTotal(0)
        setData([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [period])

  const chartHeight = compact ? 160 : 220

  return (
    <div className="admin-module-card">
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h3 className="text-[0.9375rem] font-black tracking-tight text-[var(--admin-text)]">{title}</h3>
          <p className="mt-1 text-[0.78rem] font-semibold text-[var(--admin-text-muted)]">
            {subtitle ?? `${period} — revenue from delivered orders`}
          </p>
        </div>
        {!compact ? (
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--admin-text-muted)]">Total</p>
            <p className="mt-0.5 text-xl font-black text-[var(--admin-text)]">
              {loading ? '…' : offline ? '—' : formatBDT(total)}
            </p>
          </div>
        ) : null}
      </div>

      {loading ? (
        <div className="flex animate-pulse flex-col gap-2" style={{ height: chartHeight }}>
          <div className="flex h-full items-end gap-2 px-2">
            {[40, 65, 50, 80, 60, 90, 70].map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-t-sm bg-[var(--admin-accent-muted)]"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
        </div>
      ) : offline || data.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--admin-glass-border-subtle)] bg-[var(--admin-accent-muted)] text-center"
          style={{ height: chartHeight }}
        >
          <p className="text-sm font-semibold text-[var(--admin-text-muted)]">
            {offline
              ? 'API offline — start backend on port 4000'
              : total > 0
                ? `${formatBDT(total)} total — no daily breakdown available`
                : 'No revenue data yet'}
          </p>
          <p className="text-xs font-medium text-[var(--admin-text-muted)] opacity-80">
            {offline
              ? 'Chart loads when API is connected'
              : total > 0
                ? 'The chart appears once the API returns a revenue timeline'
                : 'Complete orders to see revenue chart'}
          </p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={chartHeight}>
          <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#16181d" stopOpacity={0.28} />
                <stop offset="100%" stopColor="#16181d" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--admin-glass-border-subtle)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: 'var(--admin-text-muted)', fontSize: 10, fontWeight: 600 }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fill: 'var(--admin-text-muted)', fontSize: 10, fontWeight: 600 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => v >= 1000 ? `৳${Math.round(v / 1000)}k` : `৳${v}`}
              width={52}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--admin-accent-border)', strokeWidth: 1.5 }} />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="var(--admin-accent)"
              strokeWidth={2}
              fill="url(#revenueGradient)"
              dot={false}
              activeDot={{ r: 4.5, fill: 'var(--admin-accent)', stroke: 'var(--admin-surface)', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
