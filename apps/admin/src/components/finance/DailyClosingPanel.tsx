'use client'

import { useCallback, useEffect, useState } from 'react'
import { CalendarCheck, RefreshCw } from 'lucide-react'
import { AdminButton } from '@/components/ui/AdminButton'
import { toastOk, toastFail } from '@/lib/admin/feedback'
import { fetchDailyClosings, runDailyClosing } from '@/lib/api/finance'
import { formatBDT } from '@/lib/format/currency'

interface DailyClosingRow {
  id: string
  closingDate: string
  totalOrders: number
  totalRevenue: number | string
  totalExpenses: number | string
  netProfit: number | string
  status: string
  closedBy?: string | null
}

export function DailyClosingPanel() {
  const [items, setItems] = useState<DailyClosingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [apiOnline, setApiOnline] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchDailyClosings(1, 30)
      setItems((res.items ?? []) as DailyClosingRow[])
      setApiOnline(true)
    } catch {
      setItems([])
      setApiOnline(false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const handleRun = async () => {
    if (!apiOnline) {
      toastFail('API offline — cannot run daily closing.', 'closing-offline')
      return
    }
    setRunning(true)
    try {
      await runDailyClosing('admin')
      const res = await fetchDailyClosings(1, 30)
      const rows = (res.items ?? []) as DailyClosingRow[]
      setItems(rows)
      const today = new Date().toISOString().slice(0, 10)
      const hasToday = rows.some((row) => String(row.closingDate).slice(0, 10) === today)
      if (!hasToday) {
        toastFail('Daily closing API responded but today\'s record not found — refresh and retry.')
        return
      }
      toastOk('Daily closing recorded for today', 'closing-ok')
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'Could not run daily closing', 'closing-fail')
    } finally {
      setRunning(false)
    }
  }

  if (loading) {
    return <div className="h-40 animate-pulse rounded-[22px] bg-[var(--admin-surface-muted)]" />
  }

  return (
    <div className="space-y-5">
      {!apiOnline ? (
        <div className="admin-settings-status admin-settings-status--offline">
          <p className="text-xs font-semibold text-amber-900">
            API offline — start backend on port 4000. No fake closing data is shown.
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <AdminButton variant="gold" loading={running} disabled={!apiOnline} onClick={() => void handleRun()}>
          <CalendarCheck className="h-4 w-4" />
          Run today&apos;s closing
        </AdminButton>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-2 rounded-xl border border-[var(--admin-glass-border-subtle)] bg-[var(--admin-glass-strong)] px-4 py-2 text-xs font-black uppercase tracking-wider text-[var(--admin-text-secondary)]"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      <section className="partner-hero-card">
        <div>
          <p className="admin-kpi__label">End-of-day finance closing</p>
          <h3 className="mt-1 text-lg font-black text-[var(--admin-text)]">Daily Closing Ledger</h3>
          <p className="mt-1 text-sm font-semibold text-[var(--admin-text-secondary)]">
            Orders, revenue, expenses, and partner balances snapshotted per day.
          </p>
        </div>
      </section>

      {items.length === 0 ? (
        <p className="text-sm font-semibold text-[var(--admin-text-secondary)]">
          No daily closings yet. Run today&apos;s closing when orders are recorded.
        </p>
      ) : (
        <div className="settings-card admin-panel-glass overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="admin-module-table w-full text-left text-sm">
              <thead>
                <tr>
                  {['Date', 'Orders', 'Revenue', 'Expenses', 'Net profit', 'Status', 'Closed by'].map((h) => (
                    <th key={h} className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-[var(--admin-text-muted)]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-3 font-semibold text-[var(--admin-text)]">
                      {new Date(row.closingDate).toLocaleDateString('en-GB')}
                    </td>
                    <td className="px-4 py-3">{row.totalOrders}</td>
                    <td className="px-4 py-3 font-black">{formatBDT(Number(row.totalRevenue))}</td>
                    <td className="px-4 py-3">{formatBDT(Number(row.totalExpenses))}</td>
                    <td className="px-4 py-3 font-black text-[#5E7CFF]">{formatBDT(Number(row.netProfit))}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${
                          row.status === 'APPROVED'
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                            : 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--admin-text-secondary)]">{row.closedBy ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
