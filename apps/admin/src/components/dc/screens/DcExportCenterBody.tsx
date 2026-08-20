'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { DcIcon } from '@/components/dc/DcIcon'
import { FONT, MONO } from '@/components/dc/tokens'
import { downloadCsv } from '@/lib/admin/admin-actions'
import { CATALOG_HEADERS } from '@/lib/admin/product-catalog-sheet'
import { downloadSheet } from '@/lib/admin/sheet-io'
import { toastOk, toastFail, toastWarn } from '@/lib/admin/feedback'
import { isNetworkOrServerError } from '@/lib/api/offline-defaults'
import { fetchCustomers } from '@/lib/api/customers'
import { fetchExportHistory, logExport, type ExportFormat, type ExportKind } from '@/lib/api/exports'
import { fetchOrders } from '@/lib/api/orders'
import { fetchProductsExport } from '@/lib/api/products'
import { useAdminNavigate } from '@/lib/navigation/client-nav'

const card = {
  border: '1px solid var(--line)',
  borderRadius: 14,
  background: 'var(--surface)',
  backgroundImage: 'var(--card-sheen)',
} as const

const DATE_FMT: Intl.DateTimeFormatOptions = {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Dhaka',
}

function rangeParams(from: string, to: string): { from?: string; to?: string } {
  return {
    ...(from.trim() ? { from: from.trim() } : {}),
    ...(to.trim() ? { to: to.trim() } : {}),
  }
}

/** Live CSV export — DC cards only. */
export function ExportCenterPanelLive() {
  return <DcExportCenterBody />
}

export function DcExportCenterBody() {
  const { navigate } = useAdminNavigate()
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState<string | null>(null)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const apiProbe = useQuery({
    queryKey: ['export-api-probe'],
    queryFn: () => fetchOrders({ limit: 1 }),
    staleTime: 30_000,
    retry: false,
  })
  const history = useQuery({
    queryKey: ['export-history'],
    queryFn: fetchExportHistory,
    staleTime: 15_000,
    retry: false,
    enabled: !(apiProbe.isError && isNetworkOrServerError(apiProbe.error)),
  })
  const apiOffline = apiProbe.isError && isNetworkOrServerError(apiProbe.error)
  const dates = rangeParams(from, to)

  const recordExport = async (kind: ExportKind, format: ExportFormat, rowCount: number) => {
    try {
      await logExport({ kind, format, rowCount, ...dates })
      await queryClient.invalidateQueries({ queryKey: ['export-history'] })
    } catch {
      /* history write is best-effort — the file already downloaded */
    }
  }

  const exportDataset = async (kind: ExportKind, format: ExportFormat = 'csv') => {
    if (apiOffline) {
      toastFail('Export unavailable — API offline.', 'export-offline')
      return
    }
    setBusy(`${kind}-${format}`)
    try {
      if (kind === 'orders') {
        const rows: string[][] = [['Invoice', 'Customer', 'Status', 'Total', 'Created']]
        let page = 1
        let totalPages = 1
        const maxPages = 200
        do {
          const data = await fetchOrders({ limit: 100, page, ...dates })
          for (const o of data.orders) {
            rows.push([
              o.invoiceNumber,
              o.shippingName,
              o.status,
              String(o.total),
              o.createdAt,
            ])
          }
          totalPages = data.totalPages ?? 1
          page += 1
        } while (page <= totalPages && page <= maxPages)
        if (totalPages > maxPages) {
          toastWarn(
            `Orders export stopped at ${rows.length - 1} rows (page cap). Narrow the date range.`,
            'export-orders-cap',
          )
        }
        if (format === 'xlsx') downloadSheet('splaro-orders.xlsx', rows, 'xlsx')
        else downloadCsv('splaro-orders.csv', rows)
        const rowCount = rows.length - 1
        await recordExport(kind, format, rowCount)
        toastOk(
          `Orders exported — ${rowCount} row${rowCount === 1 ? '' : 's'} (${format.toUpperCase()}).`,
          `export-orders-${format}`,
        )
        return
      } else if (kind === 'customers') {
        const rows: string[][] = [['Name', 'Phone', 'Email', 'Orders', 'Total spent', 'Tier']]
        let page = 1
        let totalPages = 1
        const maxPages = 200
        do {
          const data = await fetchCustomers({ limit: 100, page, ...dates })
          for (const c of data.customers) {
            rows.push([
              `${c.firstName} ${c.lastName}`.trim(),
              c.phone,
              c.email ?? '',
              String(c.totalOrders),
              String(c.totalSpent),
              c.loyaltyTier,
            ])
          }
          totalPages = data.totalPages ?? Math.max(1, Math.ceil((data.total || 0) / 100))
          page += 1
        } while (page <= totalPages && page <= maxPages)
        if (totalPages > maxPages) {
          toastWarn(
            `Customers export stopped at ${rows.length - 1} rows (page cap).`,
            'export-customers-cap',
          )
        }
        if (format === 'xlsx') downloadSheet('splaro-customers.xlsx', rows, 'xlsx')
        else downloadCsv('splaro-customers.csv', rows)
        const rowCount = rows.length - 1
        await recordExport(kind, format, rowCount)
        toastOk(
          `Customers exported — ${rowCount} row${rowCount === 1 ? '' : 's'} (${format.toUpperCase()}).`,
          `export-customers-${format}`,
        )
        return
      } else {
        const data = await fetchProductsExport(dates)
        const rows: string[][] = [
          [...CATALOG_HEADERS],
          ...data.rows.map((r) => CATALOG_HEADERS.map((h) => r[h] ?? '')),
        ]
        downloadSheet(
          format === 'xlsx' ? 'splaro-products.xlsx' : 'splaro-products.csv',
          rows,
          format,
        )
        await recordExport(kind, format, data.total)
        toastOk(
          `Products exported — ${data.total} variant row${data.total === 1 ? '' : 's'} (${format.toUpperCase()}).`,
          `export-products-${format}`,
        )
        return
      }
    } catch {
      toastFail('Export failed — is the API running?', 'export-fail')
    } finally {
      setBusy(null)
    }
  }

  const exports = [
    {
      label: 'Orders',
      kind: 'orders' as const,
      desc: 'Orders by created date (empty range = all)',
      icon: 'icon-shopping-bag',
      excel: true,
    },
    {
      label: 'Customers',
      kind: 'customers' as const,
      desc: 'Customers by joined date — name, phone, spend, tier',
      icon: 'icon-users',
      excel: true,
    },
    {
      label: 'Products',
      kind: 'products' as const,
      desc: 'Products by created date — Bangla, images, collections, variants',
      icon: 'icon-package',
      excel: true,
    },
  ]

  const historyItems = history.data?.items ?? []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {apiOffline ? (
        <div
          style={{
            ...card,
            padding: '12px 14px',
            borderColor: 'var(--warn-bd)',
            background: 'var(--warn-soft)',
            font: `600 12.5px/1.4 ${FONT}`,
            color: 'var(--ink-2)',
          }}
        >
          API offline — exports will fail until :4000 is up.
        </div>
      ) : null}

      <div
        style={{
          ...card,
          padding: '14px 16px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          alignItems: 'end',
        }}
      >
        <label style={{ display: 'grid', gap: 4, font: `600 11px/1 ${FONT}`, color: 'var(--ink-3)' }}>
          From
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="admin-input"
          />
        </label>
        <label style={{ display: 'grid', gap: 4, font: `600 11px/1 ${FONT}`, color: 'var(--ink-3)' }}>
          To
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="admin-input"
          />
        </label>
        {from || to ? (
          <button
            type="button"
            onClick={() => {
              setFrom('')
              setTo('')
            }}
            style={{
              height: 34,
              padding: '0 12px',
              borderRadius: 9,
              border: '1px solid var(--line-2)',
              background: 'var(--surface-2)',
              color: 'var(--ink)',
              font: `600 12px/1 ${FONT}`,
              cursor: 'pointer',
            }}
          >
            Clear dates
          </button>
        ) : null}
        <p style={{ font: `500 12px/1.4 ${FONT}`, color: 'var(--ink-3)', margin: 0, flex: '1 1 180px' }}>
          Asia/Dhaka. Leave empty to export every row.
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 10,
        }}
      >
        {[
          { label: 'Datasets', value: '3' },
          { label: 'Format', value: 'CSV + Excel' },
          {
            label: 'API',
            value: apiProbe.isLoading ? '…' : apiOffline ? 'Offline' : 'Live',
          },
          { label: 'Range', value: from || to ? `${from || '…'} → ${to || '…'}` : 'All rows' },
        ].map((k) => (
          <div key={k.label} style={{ ...card, padding: '12px 14px' }}>
            <div
              style={{
                font: `600 10.5px/1 ${FONT}`,
                letterSpacing: '.08em',
                textTransform: 'uppercase',
                color: 'var(--ink-3)',
                marginBottom: 6,
              }}
            >
              {k.label}
            </div>
            <div style={{ font: `700 18px/1 ${MONO}`, color: 'var(--ink)' }}>{k.value}</div>
          </div>
        ))}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 12,
        }}
      >
        {exports.map((ex) => (
          <section
            key={ex.kind}
            style={{ ...card, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span
                style={{
                  display: 'grid',
                  placeItems: 'center',
                  width: 32,
                  height: 32,
                  borderRadius: 9,
                  background: 'var(--surface-2)',
                  color: 'var(--violet)',
                }}
              >
                <DcIcon name={ex.icon} size={15} />
              </span>
              <div>
                <p style={{ font: `600 13.5px/1.2 ${FONT}`, color: 'var(--ink)' }}>{ex.label}</p>
                <p style={{ font: `400 11.5px/1.3 ${FONT}`, color: 'var(--ink-3)' }}>{ex.desc}</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                disabled={busy !== null || apiOffline}
                onClick={() => void exportDataset(ex.kind, 'csv')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  flex: 1,
                  height: 36,
                  borderRadius: 9,
                  border: 0,
                  background: 'var(--violet-solid)',
                  color: 'var(--on-violet)',
                  font: `600 12.5px/1 ${FONT}`,
                  cursor: busy || apiOffline ? 'not-allowed' : 'pointer',
                  opacity: busy || apiOffline ? 0.55 : 1,
                }}
              >
                <DcIcon name="icon-download" size={14} />
                {busy === `${ex.kind}-csv` ? 'Exporting…' : 'CSV'}
              </button>
              {ex.excel ? (
                <button
                  type="button"
                  disabled={busy !== null || apiOffline}
                  onClick={() => void exportDataset(ex.kind, 'xlsx')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    flex: 1,
                    height: 36,
                    borderRadius: 9,
                    border: '1px solid var(--line-2)',
                    background: 'var(--surface-2)',
                    color: 'var(--ink)',
                    font: `600 12.5px/1 ${FONT}`,
                    cursor: busy || apiOffline ? 'not-allowed' : 'pointer',
                    opacity: busy || apiOffline ? 0.55 : 1,
                  }}
                >
                  <DcIcon name="icon-file-spreadsheet" size={14} />
                  {busy === `${ex.kind}-xlsx` ? 'Exporting…' : 'Excel'}
                </button>
              ) : null}
            </div>
          </section>
        ))}
      </div>

      <section style={{ ...card, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <p style={{ font: `600 13.5px/1.2 ${FONT}`, color: 'var(--ink)', margin: 0 }}>Export history</p>
        {history.isError ? (
          <p style={{ font: `500 12.5px/1.4 ${FONT}`, color: 'var(--ink-3)', margin: 0 }}>
            History unavailable — {history.error instanceof Error ? history.error.message : 'request failed'}.
          </p>
        ) : history.isLoading ? (
          <p style={{ font: `500 12.5px/1.4 ${FONT}`, color: 'var(--ink-3)', margin: 0 }}>Loading history…</p>
        ) : historyItems.length === 0 ? (
          <p style={{ font: `500 12.5px/1.4 ${FONT}`, color: 'var(--ink-3)', margin: 0 }}>
            No exports logged yet. A row appears after a successful download.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', font: `500 12.5px/1.4 ${FONT}` }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--ink-3)', font: `600 10.5px/1 ${FONT}`, letterSpacing: '.06em', textTransform: 'uppercase' }}>
                  <th style={{ padding: '8px 10px 8px 0' }}>Date</th>
                  <th style={{ padding: '8px 10px' }}>Type</th>
                  <th style={{ padding: '8px 10px' }}>Rows</th>
                  <th style={{ padding: '8px 0 8px 10px' }}>Triggered by</th>
                </tr>
              </thead>
              <tbody>
                {historyItems.map((row) => (
                  <tr key={row.id} style={{ borderTop: '1px solid var(--line)' }}>
                    <td style={{ padding: '9px 10px 9px 0', color: 'var(--ink)', whiteSpace: 'nowrap' }}>
                      {new Date(row.createdAt).toLocaleString('en-GB', DATE_FMT)}
                    </td>
                    <td style={{ padding: '9px 10px', color: 'var(--ink)', textTransform: 'capitalize' }}>
                      {row.kind}
                      {row.format ? ` · ${row.format.toUpperCase()}` : ''}
                    </td>
                    <td style={{ padding: '9px 10px', font: `600 12.5px/1.4 ${MONO}`, color: 'var(--ink)' }}>
                      {row.rowCount}
                    </td>
                    <td style={{ padding: '9px 0 9px 10px', color: 'var(--ink-2)' }}>{row.triggeredBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p style={{ font: `500 12px/1.45 ${FONT}`, color: 'var(--ink-3)' }}>
        Product import (create/update) lives under Catalog → Bulk & CSV. PDF invoices use Orders →
        Print. Google Sheets sync lives under Integrations → Google Sheets.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button
          type="button"
          onClick={() => navigate('/dashboard/bulk')}
          style={{
            height: 34,
            padding: '0 12px',
            borderRadius: 9,
            border: '1px solid var(--line-2)',
            background: 'var(--surface-2)',
            color: 'var(--ink)',
            font: `600 12.5px/1 ${FONT}`,
            cursor: 'pointer',
          }}
        >
          Bulk import →
        </button>
        <button
          type="button"
          onClick={() => navigate('/dashboard/automation/google-sheets-sync')}
          style={{
            height: 34,
            padding: '0 12px',
            borderRadius: 9,
            border: '1px solid var(--line-2)',
            background: 'var(--surface-2)',
            color: 'var(--ink)',
            font: `600 12.5px/1 ${FONT}`,
            cursor: 'pointer',
          }}
        >
          Google Sheets →
        </button>
      </div>
    </div>
  )
}
