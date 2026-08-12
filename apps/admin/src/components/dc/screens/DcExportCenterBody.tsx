'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { DcIcon } from '@/components/dc/DcIcon'
import { FONT, MONO } from '@/components/dc/tokens'
import { downloadCsv } from '@/lib/admin/admin-actions'
import { CATALOG_HEADERS } from '@/lib/admin/product-catalog-sheet'
import { downloadSheet } from '@/lib/admin/sheet-io'
import { toastOk, toastFail } from '@/lib/admin/feedback'
import { isNetworkOrServerError } from '@/lib/api/offline-defaults'
import { fetchCustomers } from '@/lib/api/customers'
import { fetchOrders } from '@/lib/api/orders'
import { fetchProductsExport } from '@/lib/api/products'
import { useAdminNavigate } from '@/lib/navigation/client-nav'

const card = {
  border: '1px solid var(--line)',
  borderRadius: 14,
  background: 'var(--surface)',
  backgroundImage: 'var(--card-sheen)',
} as const

/** Live CSV export — DC cards only. */
export function ExportCenterPanelLive() {
  return <DcExportCenterBody />
}

export function DcExportCenterBody() {
  const { navigate } = useAdminNavigate()
  const [busy, setBusy] = useState<string | null>(null)
  const apiProbe = useQuery({
    queryKey: ['export-api-probe'],
    queryFn: () => fetchOrders({ limit: 1 }),
    staleTime: 30_000,
    retry: false,
  })
  const apiOffline = apiProbe.isError && isNetworkOrServerError(apiProbe.error)

  const exportDataset = async (
    kind: 'orders' | 'customers' | 'products',
    format: 'csv' | 'xlsx' = 'csv',
  ) => {
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
        do {
          const data = await fetchOrders({ limit: 100, page })
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
        } while (page <= totalPages && page <= 50)
        if (format === 'xlsx') downloadSheet('splaro-orders.xlsx', rows, 'xlsx')
        else downloadCsv('splaro-orders.csv', rows)
      } else if (kind === 'customers') {
        const data = await fetchCustomers({ limit: 100 })
        // Customers API is single-page today — pull max available page size repeatedly if totalPages appears later.
        const rows = [
          ['Name', 'Phone', 'Email', 'Orders', 'Total spent', 'Tier'],
          ...data.customers.map((c) => [
            `${c.firstName} ${c.lastName}`,
            c.phone,
            c.email ?? '',
            String(c.totalOrders),
            String(c.totalSpent),
            c.loyaltyTier,
          ]),
        ]
        if (format === 'xlsx') downloadSheet('splaro-customers.xlsx', rows, 'xlsx')
        else downloadCsv('splaro-customers.csv', rows)
      } else {
        const data = await fetchProductsExport()
        const rows: string[][] = [
          [...CATALOG_HEADERS],
          ...data.rows.map((r) => CATALOG_HEADERS.map((h) => r[h] ?? '')),
        ]
        downloadSheet(
          format === 'xlsx' ? 'splaro-products.xlsx' : 'splaro-products.csv',
          rows,
          format,
        )
      }
      toastOk(
        `${kind} exported as ${format.toUpperCase()}.`,
        `export-${kind}-${format}`,
      )
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
      desc: 'Orders (paginated export)',
      icon: 'icon-shopping-bag',
      excel: true,
    },
    {
      label: 'Customers',
      kind: 'customers' as const,
      desc: 'Customer CRM export',
      icon: 'icon-users',
      excel: true,
    },
    {
      label: 'Products',
      kind: 'products' as const,
      desc: 'Full catalog — Bangla, images, collections',
      icon: 'icon-package',
      excel: true,
    },
  ]

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
          { label: 'Products', value: 'All rows' },
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

      <p style={{ font: `500 12px/1.45 ${FONT}`, color: 'var(--ink-3)' }}>
        Product import (create/update) lives under Catalog → Bulk & CSV. PDF invoices use Orders →
        Print. Google Sheets sync lives under Finance → Google Sheets.
      </p>
      <button
        type="button"
        onClick={() => navigate('/dashboard/bulk')}
        style={{
          alignSelf: 'flex-start',
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
    </div>
  )
}
