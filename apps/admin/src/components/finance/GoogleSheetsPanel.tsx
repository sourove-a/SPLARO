'use client'

import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, Sheet } from 'lucide-react'
import { AdminButton } from '@/components/ui/AdminButton'
import { toastFail, toastWarn } from '@/lib/admin/feedback'
import {
  fetchSheetsDashboard,
  syncAllSheets,
  retryFailedSheets,
} from '@/lib/api/finance'

export function GoogleSheetsPanel() {
  const [data, setData] = useState<{
    sheets?: Array<{
      sheetType: string
      configured: boolean
      lastSync: string | null
      lastStatus: string | null
      lastError: string | null
    }>
    stats?: { total: number; completed: number; failed: number; pending: number }
  } | null>(null)
  const [busy, setBusy] = useState(false)
  const [apiOnline, setApiOnline] = useState(true)

  const load = useCallback(() => {
    fetchSheetsDashboard()
      .then((res) => {
        setData(res as NonNullable<typeof data>)
        setApiOnline(true)
      })
      .catch(() => {
        setData(null)
        setApiOnline(false)
      })
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleSyncAll = async () => {
    if (!apiOnline) {
      toastFail('API offline — cannot sync sheets.', 'sheets-offline')
      return
    }
    setBusy(true)
    try {
      await syncAllSheets('admin')
      toastWarn('Google Sheets sync queued — refresh to confirm completion.', 'sheets-sync-queued')
      load()
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'Sync failed', 'sheets-sync-fail')
    } finally {
      setBusy(false)
    }
  }

  const handleRetry = async () => {
    if (!apiOnline) {
      toastFail('API offline — cannot retry sheet syncs.', 'sheets-offline')
      return
    }
    setBusy(true)
    try {
      await retryFailedSheets()
      toastWarn('Retry queued for failed sheet syncs — refresh to confirm.', 'sheets-retry-queued')
      load()
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'Retry failed', 'sheets-retry-fail')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      {!apiOnline ? (
        <div className="admin-settings-status admin-settings-status--offline">
          <p className="text-xs font-semibold text-amber-900">
            Google Sheets API offline — configure credentials in API env first.
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <AdminButton variant="gold" loading={busy} disabled={!apiOnline} onClick={() => void handleSyncAll()}>
          <Sheet className="h-3.5 w-3.5" />
          Sync all sheets
        </AdminButton>
        <button
          type="button"
          onClick={() => void handleRetry()}
          disabled={busy || !apiOnline}
          className="inline-flex items-center gap-2 rounded-xl border border-[var(--admin-glass-border-subtle)] bg-[var(--admin-glass-strong)] px-4 py-2 text-xs font-black uppercase tracking-wider text-[var(--admin-text-secondary)] disabled:opacity-50"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Retry failed
        </button>
      </div>

      {data?.stats ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            ['Total', data.stats.total],
            ['Completed', data.stats.completed],
            ['Failed', data.stats.failed],
            ['Pending', data.stats.pending],
          ].map(([label, val]) => (
            <div key={label as string} className="partner-kpi-card text-center">
              <p className="admin-kpi__label">{label}</p>
              <p className="mt-2 text-xl font-black text-[var(--admin-text)]">{val}</p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="settings-card admin-panel-glass overflow-hidden p-0">
        <table className="admin-module-table w-full text-left text-sm">
          <thead>
            <tr>
              {['Sheet', 'Configured', 'Last sync', 'Status'].map((h) => (
                <th key={h} className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-[var(--admin-text-muted)]">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(data?.sheets ?? []).length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm font-semibold text-[var(--admin-text-secondary)]">
                  No sheet sync config found. Set Google Sheets credentials in API settings.
                </td>
              </tr>
            ) : (
              (data?.sheets ?? []).map((s) => (
                <tr key={s.sheetType}>
                  <td className="px-4 py-3 font-semibold text-[var(--admin-text)]">{s.sheetType.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-3">{s.configured ? 'Yes' : '—'}</td>
                  <td className="px-4 py-3 text-[var(--admin-text-secondary)]">
                    {s.lastSync ? new Date(s.lastSync).toLocaleString('en-BD') : 'Never'}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-black text-[var(--admin-text)]">{s.lastStatus ?? '—'}</span>
                    {s.lastError ? (
                      <p className="mt-0.5 text-[10px] text-red-600 dark:text-red-400">{s.lastError}</p>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
