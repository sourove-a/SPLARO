'use client'

import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

import { DcPageHead } from '@/components/dc/DcPageHead'
import { DcIcon } from '@/components/dc/DcIcon'
import { DcScreenProvider } from '@/components/dc/DcScreenContext'
import { DcEmptyState, DcErrorState, DcLoadingState } from '@/components/dc/blocks/DcStates'
import type { DcBlock } from '@/components/dc/blocks/types'
import { dcPageStatus } from '@/components/dc/page-status'
import { FONT, MONO, formatTaka } from '@/components/dc/tokens'
import { toastFail } from '@/lib/admin/feedback'
import {
  fetchOrderProfitDetail,
  fetchOrderProfitList,
  type OrderProfitDetail,
  type OrderProfitRow,
} from '@/lib/api/finance'
import { useAdminConnection } from '@/lib/hooks/use-admin-connection'
import { financeGhostBtn, financePagerBtn, financePeriodPill } from '@/components/dc/screens/finance-ui'

const card = {
  border: '1px solid var(--line)',
  borderRadius: 14,
  background: 'var(--surface)',
  backgroundImage: 'var(--card-sheen)',
} as const

const PRESETS = [
  { id: 'today', label: 'Today' },
  { id: '7d', label: '7D' },
  { id: '30d', label: '30D' },
  { id: 'this_month', label: 'This month' },
] as const

const th = {
  textAlign: 'left' as const,
  padding: '9px 12px',
  font: `600 10.5px/1 ${FONT}`,
  letterSpacing: '.09em',
  textTransform: 'uppercase' as const,
  color: 'var(--ink-3)',
  borderBottom: '1px solid var(--line)',
  whiteSpace: 'nowrap' as const,
}

const td = {
  padding: '10px 12px',
  font: `500 13px/1.3 ${FONT}`,
  color: 'var(--ink)',
  borderBottom: '1px solid var(--line)',
  verticalAlign: 'top' as const,
}

export function DcOrderProfitability() {
  const router = useRouter()
  return (
    <DcScreenProvider screen="finance" onNavigate={(next) => router.push(`/dashboard/${next}`)}>
      <DcOrderProfitabilityBody />
    </DcScreenProvider>
  )
}

function DcOrderProfitabilityBody() {
  const router = useRouter()
  const { api } = useAdminConnection(25_000)
  const [preset, setPreset] = useState<(typeof PRESETS)[number]['id']>('30d')
  const [page, setPage] = useState(1)
  const [openId, setOpenId] = useState<string | null>(null)

  const list = useQuery({
    queryKey: ['finance-order-profit', preset, page],
    queryFn: () => fetchOrderProfitList({ preset, page: String(page), limit: '25' }),
    staleTime: 30_000,
    retry: 1,
  })

  const detail = useQuery({
    queryKey: ['finance-order-profit-detail', openId],
    queryFn: () => fetchOrderProfitDetail(openId!),
    enabled: Boolean(openId),
    retry: 1,
  })

  const pageStatus = dcPageStatus([list], api.pulse)
  const rows = list.data?.items ?? []
  const totalPages = Math.max(1, Math.ceil((list.data?.total ?? 0) / (list.data?.limit ?? 25)))

  const skeleton: DcBlock[] = [{ t: 'seg' } as DcBlock, { t: 'table', w: 'main', title: '', cols: [], rows: [] } as DcBlock]

  return (
    <>
      <DcPageHead
        crumbGroup="Finance"
        title="Order Profitability"
        statusLabel={pageStatus.label}
        statusTone={pageStatus.tone}
        syncLabel={list.isFetching ? 'syncing…' : `${list.data?.total ?? 0} delivered`}
        syncing={list.isFetching}
        onSync={() => void list.refetch()}
        actions={[
          {
            label: 'Profit & Cash Flow',
            icon: 'icon-file-bar-chart',
            variant: 'ghost',
            onClick: () => router.push('/dashboard/finance/finance-reports'),
          },
        ]}
      />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {PRESETS.map((p) => {
          const active = preset === p.id
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setPreset(p.id)
                setPage(1)
              }}
              style={financePeriodPill(active)}
            >
              {p.label}
            </button>
          )
        })}
      </div>

      {list.error ? (
        <DcErrorState
          error={`GET /admin/finance/orders → ${list.error instanceof Error ? list.error.message : 'failed'}`}
          hint="No invented margins. Retry when the API is up."
          onRetry={() => void list.refetch()}
        />
      ) : list.isLoading ? (
        <DcLoadingState blocks={skeleton} />
      ) : rows.length === 0 ? (
        <DcEmptyState
          icon="icon-calculator"
          title="No delivered orders in this window"
          body="Profit rows appear after an order is marked DELIVERED."
        />
      ) : (
        <>
          <div className="dc-mobile-route-panel" aria-label="Order profitability">
            <div className="dc-mobile-list">
              {rows.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  className="dc-mobile-list-card"
                  onClick={() => setOpenId(row.id)}
                >
                  <span
                    className="dc-mobile-list-card__icon"
                    style={{
                      background: row.netProfit >= 0 ? 'var(--ok-soft)' : 'var(--bad-soft)',
                      color: row.netProfit >= 0 ? 'var(--ok)' : 'var(--bad)',
                    }}
                  >
                    <DcIcon name="icon-calculator" size={15} />
                  </span>
                  <span className="dc-mobile-list-card__copy">
                    <span className="dc-mobile-list-card__title">{row.orderNumber}</span>
                    <span className="dc-mobile-list-card__sub">
                      {new Date(row.deliveredAt).toLocaleDateString('en-BD', {
                        day: 'numeric',
                        month: 'short',
                      })}
                      {row.marginPct == null ? '' : ` · ${row.marginPct}% margin`}
                      {row.incompleteReasons.length ? ' · incomplete' : ''}
                    </span>
                  </span>
                  <span
                    className="dc-mobile-list-card__value"
                    style={{ color: row.netProfit >= 0 ? 'var(--ok)' : 'var(--bad)' }}
                  >
                    {formatTaka(row.netProfit)}
                  </span>
                </button>
              ))}
            </div>
            <OrderProfitPagination page={page} totalPages={totalPages} onPage={setPage} />
          </div>

          <div className="dc-desktop-route-panel">
            <div style={{ ...card, overflow: 'auto' }}>
              <table style={{ width: '100%', minWidth: 960, borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Order', 'Selling', 'Cost', 'Pack', 'Courier', 'Fee', 'Discount', 'Ads', 'Net', 'Margin'].map(
                      (h) => (
                        <th key={h} style={th}>
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} onClick={() => setOpenId(row.id)} style={{ cursor: 'pointer' }}>
                      <td style={td}>
                        <div style={{ font: `600 13px/1.3 ${MONO}` }}>{row.orderNumber}</div>
                        <div style={{ marginTop: 4, font: `500 11.5px/1 ${FONT}`, color: 'var(--ink-3)' }}>
                          {new Date(row.deliveredAt).toLocaleDateString('en-BD', {
                            day: 'numeric',
                            month: 'short',
                          })}
                          {row.incompleteReasons.length ? ' · incomplete' : ''}
                        </div>
                      </td>
                      <td style={td}>{formatTaka(row.selling)}</td>
                      <td style={td}>{formatTaka(row.productCost)}</td>
                      <td style={td}>{formatTaka(row.packaging)}</td>
                      <td style={td}>{formatTaka(row.courier)}</td>
                      <td style={td}>{formatTaka(row.paymentFee)}</td>
                      <td style={td}>{formatTaka(row.discount)}</td>
                      <td style={td}>{formatTaka(row.allocatedAds)}</td>
                      <td style={{ ...td, color: row.netProfit >= 0 ? 'var(--ok)' : 'var(--bad)', fontWeight: 700 }}>
                        {formatTaka(row.netProfit)}
                      </td>
                      <td style={td}>{row.marginPct == null ? '—' : `${row.marginPct}%`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <OrderProfitPagination page={page} totalPages={totalPages} onPage={setPage} />
            </div>
          </div>
        </>
      )}

      {openId ? (
        <OrderDrawer
          loading={detail.isLoading}
          error={detail.error}
          row={detail.data ?? rows.find((r) => r.id === openId) ?? null}
          onClose={() => setOpenId(null)}
        />
      ) : null}
    </>
  )
}

function OrderDrawer({
  loading,
  error,
  row,
  onClose,
}: {
  loading: boolean
  error: unknown
  row: OrderProfitRow | OrderProfitDetail | null
  onClose: () => void
}) {
  const detail = row && 'items' in row ? (row as OrderProfitDetail) : null
  const lines = useMemo(() => {
    if (!row) return []
    return [
      ['Selling', row.selling],
      ['Product cost', row.productCost],
      ['Packaging', row.packaging],
      ['Courier', row.courier],
      ['Payment fee', row.paymentFee],
      ['Discount', row.discount],
      ['Allocated ads', row.allocatedAds],
      ['Return loss', row.returnLoss],
      ['Net profit', row.netProfit],
    ] as Array<[string, number]>
  }, [row])

  useEffect(() => {
    if (error && !row) {
      toastFail(error instanceof Error ? error.message : 'Could not load order profit.')
    }
  }, [error, row])

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 80,
        background: 'color-mix(in srgb, var(--ink) 35%, transparent)',
        display: 'flex',
        justifyContent: 'flex-end',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 'min(420px, 100%)',
          height: '100%',
          background: 'var(--paper)',
          borderLeft: '1px solid var(--line)',
          overflow: 'auto',
          padding: 20,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <strong style={{ flex: 1, font: `700 16px/1 ${FONT}` }}>{row?.orderNumber ?? 'Order'}</strong>
          <button type="button" onClick={onClose} style={financeGhostBtn} aria-label="Close drawer">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <DcIcon name="icon-x" size={14} /> Close
            </span>
          </button>
        </div>
        {loading ? (
          <div style={{ display: 'grid', gap: 10 }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                style={{
                  height: 18,
                  borderRadius: 6,
                  background: 'var(--surface-2)',
                  opacity: 0.7,
                }}
              />
            ))}
          </div>
        ) : !row ? (
          <p style={{ color: 'var(--bad)' }}>Order not found.</p>
        ) : (
          <>
            {row.incompleteReasons.length ? (
              <p style={{ font: `600 12.5px/1.4 ${FONT}`, color: 'var(--warn)', marginBottom: 12 }}>
                Incomplete: {row.incompleteReasons.join(', ')}
              </p>
            ) : null}
            <div style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
              {lines.map(([label, amount]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <span style={{ color: 'var(--ink-2)', font: `500 13px/1 ${FONT}` }}>{label}</span>
                  <span style={{ font: `600 13px/1 ${MONO}` }}>{formatTaka(amount)}</span>
                </div>
              ))}
            </div>
            {detail?.items?.length ? (
              <div>
                <div
                  style={{
                    font: `600 11px/1 ${FONT}`,
                    letterSpacing: '.09em',
                    textTransform: 'uppercase',
                    color: 'var(--ink-3)',
                    marginBottom: 8,
                  }}
                >
                  Line items
                </div>
                {detail.items.map((item, i) => (
                  <div
                    key={`${item.sku ?? item.productName}-${i}`}
                    style={{ ...card, padding: '10px 12px', marginBottom: 8 }}
                  >
                    <div style={{ font: `600 13px/1.3 ${FONT}` }}>{item.productName}</div>
                    <div style={{ marginTop: 4, font: `500 12px/1.4 ${FONT}`, color: 'var(--ink-3)' }}>
                      {item.quantity} × {formatTaka(item.unitPrice)}
                      {item.incomplete
                        ? ' · missing cost'
                        : ` · cost ${formatTaka((item.costPrice ?? 0) * item.quantity)}`}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}

function OrderProfitPagination({
  page,
  totalPages,
  onPage,
}: {
  page: number
  totalPages: number
  onPage: (page: number) => void
}) {
  if (totalPages <= 1) return null
  return (
    <div style={{ display: 'flex', gap: 8, padding: 12, justifyContent: 'flex-end', alignItems: 'center' }}>
      <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} style={financePagerBtn(page <= 1)}>
        Prev
      </button>
      <span style={{ font: `600 12px/1 ${FONT}`, color: 'var(--ink-3)' }}>
        {page} / {totalPages}
      </span>
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onPage(page + 1)}
        style={financePagerBtn(page >= totalPages)}
      >
        Next
      </button>
    </div>
  )
}
