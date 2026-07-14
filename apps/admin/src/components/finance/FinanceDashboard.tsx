'use client'

import { useEffect, useState } from 'react'
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Users,
  Clock,
  ArrowUpRight,
  Download,
  RefreshCw,
} from 'lucide-react'
import { AdminButton } from '@/components/ui/AdminButton'
import { PartnerSetupCard } from '@/components/finance/PartnerSetupCard'
import { toastFail, toastOk } from '@/lib/admin/feedback'
import {
  downloadFinanceCsv,
  downloadPartnerExport,
  fetchFinanceDashboard,
  type FinanceDashboardData,
} from '@/lib/api/finance'
import { formatBDT } from '@/lib/format/currency'

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  label: string
  value: string
  sub?: string
  icon: typeof TrendingUp
  accent?: string
}) {
  return (
    <div className="partner-kpi-card">
      <div className="mb-3 flex items-center justify-between">
        <span className="admin-kpi__label">{label}</span>
        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl"
          style={{ background: accent ?? 'rgba(94,124,255,0.15)' }}
        >
          <Icon className="h-4 w-4 text-[#5E7CFF]" strokeWidth={1.5} />
        </div>
      </div>
      <p className="text-2xl font-black tracking-tight text-[var(--admin-text)]">{value}</p>
      {sub ? <p className="mt-1 text-xs font-semibold text-[var(--admin-text-secondary)]">{sub}</p> : null}
    </div>
  )
}

export function FinanceDashboard() {
  const [data, setData] = useState<FinanceDashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    setError(null)
    fetchFinanceDashboard()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const handleOrdersExport = async () => {
    setExporting('orders')
    try {
      await downloadFinanceCsv('orders', 30)
      toastOk('Orders CSV downloaded')
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'Export failed')
    } finally {
      setExporting(null)
    }
  }

  const handlePartnerExport = async (partnerId: string, name: string) => {
    setExporting(partnerId)
    try {
      await downloadPartnerExport(partnerId, name)
      toastOk(`${name} report downloaded`)
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'Export failed')
    } finally {
      setExporting(null)
    }
  }

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-32 animate-pulse rounded-[22px] bg-[var(--admin-surface-muted)]" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="admin-settings-status admin-settings-status--offline space-y-4">
        <p className="text-sm font-semibold text-amber-900">
          Finance API unavailable: {error}. Ensure API is running at{' '}
          <code className="rounded bg-white/80 px-1 dark:bg-black/30">NEXT_PUBLIC_API_URL</code>.
        </p>
        <AdminButton variant="gold" onClick={load}>
          <RefreshCw className="h-4 w-4" />
          Retry
        </AdminButton>
      </div>
    )
  }

  if (!data) return null

  const noPartners = data.partners.length === 0

  return (
    <div className="space-y-6">
      {noPartners ? (
        <PartnerSetupCard partners={[]} onUpdated={load} />
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Total Revenue"
          value={formatBDT(data.totals.revenue)}
          sub="This month"
          icon={TrendingUp}
        />
        <KpiCard
          label="Total Expense"
          value={formatBDT(data.totals.expense)}
          sub="Product + courier"
          icon={TrendingDown}
          accent="rgba(239,68,68,0.1)"
        />
        <KpiCard
          label="Net Profit"
          value={formatBDT(data.totals.netProfit)}
          sub={`Today: ${formatBDT(data.totals.dailyNetProfit)}`}
          icon={Wallet}
        />
        <KpiCard
          label="Pending Approvals"
          value={String(data.pendingApprovals)}
          sub="Transactions & expenses"
          icon={Clock}
          accent="rgba(59,130,246,0.1)"
        />
      </div>

      <section className="partner-hero-card">
        <div>
          <p className="admin-kpi__label">Exports</p>
          <h3 className="mt-1 text-lg font-black text-[var(--admin-text)]">Live finance exports</h3>
          <p className="mt-1 text-sm font-semibold text-[var(--admin-text-secondary)]">
            CSV and partner reports from the live database — no demo files.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <AdminButton
            variant="gold"
            loading={exporting === 'orders'}
            disabled={!!exporting}
            onClick={() => void handleOrdersExport()}
          >
            <Download className="h-4 w-4" />
            Orders CSV (30d)
          </AdminButton>
          <AdminButton variant="ghost" onClick={load}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </AdminButton>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="settings-card admin-panel-glass p-5">
          <h3 className="admin-kpi__label mb-4">Partner Balances</h3>
          {noPartners ? (
            <p className="text-sm font-semibold text-[var(--admin-text-secondary)]">
              Partner যোগ করলে এখানে balance দেখাবে।
            </p>
          ) : (
            <div className="space-y-3">
              {data.partners.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-[16px] border border-[var(--admin-glass-border-subtle)] bg-[var(--admin-glass-strong)] px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#5E7CFF]/15">
                      <Users className="h-4 w-4 text-[#5E7CFF]" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-[var(--admin-text)]">{p.name}</p>
                      <p className="text-[10px] font-semibold text-[var(--admin-text-secondary)]">{p.sharePercent}% share</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-black text-[var(--admin-text)]">{formatBDT(p.currentBalance)}</p>
                    <button
                      type="button"
                      disabled={!!exporting}
                      onClick={() => void handlePartnerExport(p.id, p.name)}
                      className="rounded-lg border border-[var(--admin-glass-border-subtle)] p-2 text-[var(--admin-text-secondary)] transition hover:text-[#5E7CFF] disabled:opacity-50"
                      title={`Export ${p.name} report`}
                    >
                      <Download className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="settings-card admin-panel-glass p-5">
          <h3 className="admin-kpi__label mb-4">Expense Categories</h3>
          {data.expensesByCategory.length === 0 ? (
            <p className="text-sm font-semibold text-[var(--admin-text-secondary)]">No approved expenses yet.</p>
          ) : (
            <div className="space-y-2">
              {data.expensesByCategory.map((e) => (
                <div key={e.category} className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-[var(--admin-text)]">{e.category.replace(/_/g, ' ')}</span>
                  <span className="font-black text-[#5E7CFF]">{formatBDT(e.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="settings-card admin-panel-glass p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="admin-kpi__label">Recent Finance Activity</h3>
          <ArrowUpRight className="h-4 w-4 text-[var(--admin-text-muted)]" />
        </div>
        {data.recentActivity.length === 0 ? (
          <p className="text-sm font-semibold text-[var(--admin-text-secondary)]">No transactions yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="admin-module-table w-full text-left text-sm">
              <thead>
                <tr>
                  {['Partner', 'Type', 'Amount', 'Status'].map((h) => (
                    <th key={h} className="pb-2 pr-4 text-[10px] font-black uppercase tracking-wider text-[var(--admin-text-muted)]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(data.recentActivity as Array<{
                  partner?: { name: string }
                  type: string
                  amount: number
                  status: string
                }>).map((tx, i) => (
                  <tr key={i} className="border-b border-[var(--admin-glass-border-subtle)]">
                    <td className="py-2.5 pr-4 font-semibold text-[var(--admin-text)]">{tx.partner?.name ?? '—'}</td>
                    <td className="pr-4 font-medium text-[var(--admin-text-secondary)]">{tx.type.replace(/_/g, ' ')}</td>
                    <td className="pr-4 font-black text-[var(--admin-text)]">{formatBDT(Number(tx.amount))}</td>
                    <td>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${
                          tx.status === 'APPROVED'
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                            : tx.status === 'PENDING'
                              ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                              : 'bg-red-500/15 text-red-600 dark:text-red-400'
                        }`}
                      >
                        {tx.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
