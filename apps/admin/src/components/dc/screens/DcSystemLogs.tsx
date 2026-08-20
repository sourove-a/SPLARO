'use client'

import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

import { downloadCsv } from '@/lib/admin/admin-actions'
import { toastFail, toastOk, toastWarn } from '@/lib/admin/feedback'
import { DcScreenProvider } from '@/components/dc/DcScreenContext'
import { FONT } from '@/components/dc/tokens'
import { DcHubFrame, HubKpis, HubTable, HubTabs } from '@/components/dc/screens/DcHubKit'
import { fetchFinanceAuditLogs } from '@/lib/api/finance'
import { fetchSystemLogs } from '@/lib/api/platform'
import { useSystemLogs } from '@/lib/api/hooks'

const LEVELS = ['all', 'info', 'warning', 'error', 'critical'] as const
const PAGE_SIZES = [25, 50, 100] as const

export function DcSystemLogs() {
  const router = useRouter()
  return (
    <DcScreenProvider screen="system-logs" onNavigate={(next) => router.push(`/dashboard/${next}`)}>
      <DcSystemLogsBody />
    </DcScreenProvider>
  )
}

function DcSystemLogsBody() {
  const [tab, setTab] = useState<'app' | 'finance'>('app')
  const [level, setLevel] = useState<(typeof LEVELS)[number]>('all')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZES)[number]>(25)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    setPage(1)
  }, [q, level, pageSize])

  const system = useSystemLogs({
    page,
    limit: pageSize,
    q,
    ...(level === 'all' ? {} : { level }),
  })
  const finance = useQuery({
    queryKey: ['finance-audit-logs'],
    queryFn: () => fetchFinanceAuditLogs(1),
    staleTime: 20_000,
    retry: 1,
  })

  const total = system.data?.total ?? system.data?.logs?.length ?? 0
  const totalPages = system.data?.totalPages ?? Math.max(1, Math.ceil(total / pageSize))

  const rows = useMemo(() => {
    if (tab === 'finance') {
      const items = (finance.data?.items ?? []) as Record<string, unknown>[]
      return items.slice(0, 50).map((row) => [
        String(row.action ?? row.type ?? '—'),
        String(row.actor ?? row.user ?? '—'),
        String(row.target ?? row.resource ?? '—'),
        String(row.createdAt ?? row.time ?? '—'),
      ])
    }
    return (system.data?.logs ?? []).map((row) => [row.level, row.msg, row.time])
  }, [tab, system.data, finance.data])

  const exportCsv = async () => {
    if (tab === 'finance') {
      const items = (finance.data?.items ?? []) as Record<string, unknown>[]
      if (items.length === 0) {
        toastWarn('No finance audit rows to export')
        return
      }
      downloadCsv(`splaro-finance-audit-${new Date().toISOString().slice(0, 10)}.csv`, [
        ['Action', 'Actor', 'Target', 'When'],
        ...items.map((row) => [
          String(row.action ?? row.type ?? ''),
          String(row.actor ?? row.user ?? ''),
          String(row.target ?? row.resource ?? ''),
          String(row.createdAt ?? row.time ?? ''),
        ]),
      ])
      toastOk(`Exported ${items.length} finance audit row${items.length === 1 ? '' : 's'}.`)
      return
    }
    setExporting(true)
    try {
      const data = await fetchSystemLogs({
        page: 1,
        limit: 500,
        q,
        ...(level === 'all' ? {} : { level }),
      })
      if (!data.logs.length) {
        toastWarn('No log rows to export for this filter.')
        return
      }
      downloadCsv(`splaro-system-logs-${new Date().toISOString().slice(0, 10)}.csv`, [
        ['Level', 'Message', 'When'],
        ...data.logs.map((row) => [row.level, row.msg, row.time]),
      ])
      toastOk(`Exported ${data.logs.length} log row${data.logs.length === 1 ? '' : 's'}.`)
    } catch {
      toastFail('Export failed — is the API running?', 'logs-export-fail')
    } finally {
      setExporting(false)
    }
  }

  return (
    <DcHubFrame
      crumbGroup="System"
      title="System logs"
      queries={[tab === 'app' ? system : finance]}
      empty={false}
      actions={[
        {
          label: exporting ? 'Exporting…' : 'Export CSV',
          icon: 'icon-download',
          variant: 'ghost',
          ...(exporting ? {} : { onClick: () => void exportCsv() }),
        },
      ]}
    >
      <HubTabs
        tabs={[
          { id: 'app', label: 'Application' },
          { id: 'finance', label: 'Finance audit' },
        ]}
        active={tab}
        onChange={(id) => setTab(id as 'app' | 'finance')}
      />
      <HubKpis
        items={[
          { label: 'App rows', value: tab === 'app' ? total : (system.data?.total ?? system.data?.logs?.length ?? 0) },
          { label: 'Finance rows', value: finance.data?.total ?? 0 },
        ]}
      />

      {tab === 'app' ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search logs…"
            className="admin-input"
            style={{ minWidth: 220, flex: '1 1 180px' }}
          />
          {LEVELS.map((id) => {
            const on = level === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => setLevel(id)}
                style={{
                  border: `1px solid ${on ? 'var(--ink)' : 'var(--line)'}`,
                  borderRadius: 999,
                  padding: '7px 12px',
                  background: on ? 'var(--ink)' : 'transparent',
                  color: on ? 'var(--surface)' : 'var(--ink-2)',
                  font: `600 12px/1 ${FONT}`,
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                }}
              >
                {id}
              </button>
            )
          })}
        </div>
      ) : null}

      {rows.length === 0 ? (
        <p style={{ font: `500 13px/1.45 ${FONT}`, color: 'var(--ink-3)', margin: 0 }}>
          {tab === 'app'
            ? 'No log entries match this filter. API errors, failed jobs and security events appear here.'
            : 'No finance audit rows in this window.'}
        </p>
      ) : (
        <HubTable
          columns={tab === 'finance' ? ['Action', 'Actor', 'Target', 'When'] : ['Level', 'Message', 'When']}
          rows={rows}
        />
      )}

      {tab === 'app' ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            style={{
              height: 34,
              padding: '0 12px',
              borderRadius: 9,
              border: '1px solid var(--line-2)',
              background: 'var(--surface-2)',
              color: 'var(--ink)',
              font: `600 12px/1 ${FONT}`,
              cursor: page <= 1 ? 'not-allowed' : 'pointer',
              opacity: page <= 1 ? 0.5 : 1,
            }}
          >
            Previous
          </button>
          <span style={{ font: `500 12.5px/1 ${FONT}`, color: 'var(--ink-3)' }}>
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            style={{
              height: 34,
              padding: '0 12px',
              borderRadius: 9,
              border: '1px solid var(--line-2)',
              background: 'var(--surface-2)',
              color: 'var(--ink)',
              font: `600 12px/1 ${FONT}`,
              cursor: page >= totalPages ? 'not-allowed' : 'pointer',
              opacity: page >= totalPages ? 0.5 : 1,
            }}
          >
            Next
          </button>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, font: `600 12px/1 ${FONT}`, color: 'var(--ink-3)' }}>
            Per page
            <select
              className="admin-input"
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value) as (typeof PAGE_SIZES)[number])}
            >
              {PAGE_SIZES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}
    </DcHubFrame>
  )
}
