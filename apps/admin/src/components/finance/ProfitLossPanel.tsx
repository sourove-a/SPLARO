'use client'

import { useEffect, useState } from 'react'
import { toastFail } from '@/lib/admin/feedback'
import { RefreshCw } from 'lucide-react'
import { fetchProfitLoss } from '@/lib/api/finance'
import { formatBDT } from '@/lib/format/currency'
import { cn } from '@/lib/utils/cn'

type Period = 'daily' | 'weekly' | 'monthly' | 'yearly'

interface ProfitTotals {
  grossRevenue: number
  netProfit: number
  productCost: number
  courierCost: number
  packagingCost?: number
  paymentGatewayFee?: number
  discount?: number
  returnLoss?: number
}

const PERIODS: { id: Period; label: string }[] = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'yearly', label: 'Yearly' },
]

export function ProfitLossPanel() {
  const [period, setPeriod] = useState<Period>('monthly')
  const [summary, setSummary] = useState<{
    totals?: ProfitTotals
    orderCount?: number
    period?: { from: string; to: string }
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [apiOnline, setApiOnline] = useState(true)

  const load = (p: Period) => {
    setLoading(true)
    fetchProfitLoss(p)
      .then((res) => {
        setSummary(
          res as {
            totals?: ProfitTotals
            orderCount?: number
            period?: { from: string; to: string }
          },
        )
        setApiOnline(true)
      })
      .catch(() => {
        setSummary(null)
        setApiOnline(false)
        toastFail('Profit & loss API unavailable')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load(period)
  }, [period])

  const rows = summary?.totals
    ? (
        [
          ['Gross Revenue', summary.totals.grossRevenue],
          ['Net Profit', summary.totals.netProfit],
          ['Product Cost', summary.totals.productCost],
          ['Courier Cost', summary.totals.courierCost],
          ['Packaging', summary.totals.packagingCost],
          ['Gateway Fee', summary.totals.paymentGatewayFee],
          ['Discounts', summary.totals.discount],
          ['Return Loss', summary.totals.returnLoss],
        ] as [string, number | undefined][]
      ).filter((entry): entry is [string, number] => typeof entry[1] === 'number')
    : []

  return (
    <div className="space-y-5">
      {!apiOnline ? (
        <div className="admin-settings-status admin-settings-status--offline">
          <p className="text-xs font-semibold text-amber-900">
            API offline — profit data appears when delivered orders are recorded.
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {PERIODS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPeriod(p.id)}
            className={cn(
              'rounded-full px-4 py-2 text-xs font-black uppercase tracking-wider transition',
              period === p.id
                ? 'bg-[#5E7CFF] text-white'
                : 'border border-[var(--admin-glass-border-subtle)] bg-[var(--admin-glass-strong)] text-[var(--admin-text-secondary)]',
            )}
          >
            {p.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => load(period)}
          className="ml-auto inline-flex items-center gap-2 rounded-xl border border-[var(--admin-glass-border-subtle)] bg-[var(--admin-glass-strong)] px-3 py-2 text-xs font-black uppercase tracking-wider text-[var(--admin-text-secondary)]"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      {summary?.period ? (
        <p className="text-xs font-semibold text-[var(--admin-text-secondary)]">
          Period: {new Date(summary.period.from).toLocaleDateString('en-GB')} —{' '}
          {new Date(summary.period.to).toLocaleDateString('en-GB')}
          {summary.orderCount != null ? ` · ${summary.orderCount} orders` : ''}
        </p>
      ) : null}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-[22px] bg-[var(--admin-surface-muted)]" />
          ))}
        </div>
      ) : rows.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {rows.map(([label, val]) => (
            <div key={label} className="partner-kpi-card">
              <p className="admin-kpi__label">{label}</p>
              <p className="mt-2 text-xl font-black text-[var(--admin-text)]">{formatBDT(val)}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm font-semibold text-[var(--admin-text-secondary)]">
          Profit data appears when delivered orders are recorded via the API.
        </p>
      )}
    </div>
  )
}
