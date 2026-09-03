'use client'

import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'

import { DcPageHead } from '@/components/dc/DcPageHead'
import { DcIcon } from '@/components/dc/DcIcon'
import { DcScreenProvider } from '@/components/dc/DcScreenContext'
import { DcEmptyState, DcErrorState, DcLoadingState } from '@/components/dc/blocks/DcStates'
import type { DcBlock } from '@/components/dc/blocks/types'
import { dcPageStatus } from '@/components/dc/page-status'
import { FONT, MONO, formatTaka } from '@/components/dc/tokens'
import { toastFail, toastOk, toastWarn } from '@/lib/admin/feedback'
import { downloadCsv } from '@/lib/admin/admin-actions'
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

const INCOMPLETE_FIX: Record<string, { message: string; fixLabel: string; fixHref: string }> = {
  missing_cost: {
    message: 'Product cost price is missing on one or more items — COGS is counted as ৳0 until you set it.',
    fixLabel: 'Open Products',
    fixHref: '/dashboard/products',
  },
  packaging_unset: {
    message: 'Default packaging cost per order is unset (৳0) — set it under Profit & Cash Flow settings.',
    fixLabel: 'Set packaging',
    fixHref: '/dashboard/finance/finance-reports',
  },
}

function isProfitIncomplete(row: Pick<OrderProfitRow, 'incompleteReasons'>) {
  return row.incompleteReasons.length > 0
}

function netProfitColor(row: Pick<OrderProfitRow, 'incompleteReasons' | 'netProfit'>) {
  if (isProfitIncomplete(row)) return 'var(--warn)'
  return row.netProfit >= 0 ? 'var(--ok)' : 'var(--bad)'
}

function displayMargin(row: Pick<OrderProfitRow, 'incompleteReasons' | 'marginPct'>) {
  if (isProfitIncomplete(row)) return '—'
  return row.marginPct == null ? '—' : `${row.marginPct}%`
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
  const rows = useMemo(() => list.data?.items ?? [], [list.data])
  const totalPages = Math.max(1, Math.ceil((list.data?.total ?? 0) / (list.data?.limit ?? 25)))

  const skeleton: DcBlock[] = [{ t: 'seg' } as DcBlock, { t: 'table', w: 'main', title: '', cols: [], rows: [] } as DcBlock]

  const totalSelling = useMemo(() => rows.reduce((s, r) => s + Number(r.selling || 0), 0), [rows])
  const totalNet = useMemo(() => rows.reduce((s, r) => s + Number(r.netProfit || 0), 0), [rows])
  const totalCost = useMemo(
    () =>
      rows.reduce(
        (s, r) =>
          s +
          Number(r.productCost || 0) +
          Number(r.packaging || 0) +
          Number(r.courier || 0) +
          Number(r.paymentFee || 0) +
          Number(r.allocatedAds || 0),
        0,
      ),
    [rows],
  )
  const avgMargin = totalSelling > 0 ? (totalNet / totalSelling) * 100 : 0

  const exportCsv = () => {
    if (rows.length === 0) {
      toastWarn('No order profit rows to export')
      return
    }
    const headers = [
      'Order Number',
      'Delivered Date',
      'Selling (BDT)',
      'Product Cost (BDT)',
      'Packaging (BDT)',
      'Courier (BDT)',
      'Payment Fee (BDT)',
      'Discount (BDT)',
      'Allocated Ads (BDT)',
      'Net Profit (BDT)',
      'Margin %',
      'Incomplete Status',
    ]
    const csvRows = [
      headers,
      ...rows.map((r) => [
        r.orderNumber,
        new Date(r.deliveredAt).toISOString().slice(0, 10),
        String(r.selling),
        String(r.productCost),
        String(r.packaging),
        String(r.courier),
        String(r.paymentFee),
        String(r.discount),
        String(r.allocatedAds),
        String(r.netProfit),
        displayMargin(r),
        r.incompleteReasons.length ? r.incompleteReasons.join('; ') : 'Complete',
      ]),
    ]
    downloadCsv(`splaro-order-profitability-${preset}-${new Date().toISOString().slice(0, 10)}.csv`, csvRows)
    toastOk(`Exported ${rows.length} order profitability rows`)
  }

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
            onClick: () => router.push('/dashboard/finance/finance-reports'),
          },
          {
            label: 'Export CSV',
            icon: 'icon-download',
            onClick: exportCsv,
          },
        ]}
      />

      {rows.length > 0 ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 12,
            marginBottom: 16,
          }}
        >
          <div style={{ ...card, padding: '13px 15px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ font: `600 11px/1 ${FONT}`, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>
              Total Selling
            </span>
            <span style={{ font: `700 21px/1 ${MONO}`, color: 'var(--ink)' }}>
              {formatTaka(totalSelling)}
            </span>
            <span style={{ font: `400 11px/1.3 ${FONT}`, color: 'var(--ink-3)' }}>across {rows.length} page orders</span>
          </div>

          <div style={{ ...card, padding: '13px 15px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ font: `600 11px/1 ${FONT}`, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>
              Total Costs
            </span>
            <span style={{ font: `700 21px/1 ${MONO}`, color: 'var(--ink)' }}>
              {formatTaka(totalCost)}
            </span>
            <span style={{ font: `400 11px/1.3 ${FONT}`, color: 'var(--ink-3)' }}>COGS, courier, fees & ads</span>
          </div>

          <div style={{ ...card, padding: '13px 15px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ font: `600 11px/1 ${FONT}`, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>
              Net Profit
            </span>
            <span style={{ font: `700 21px/1 ${MONO}`, color: totalNet >= 0 ? 'var(--ok)' : 'var(--bad)' }}>
              {formatTaka(totalNet)}
            </span>
            <span style={{ font: `400 11px/1.3 ${FONT}`, color: 'var(--ink-3)' }}>retained bottom line</span>
          </div>

          <div style={{ ...card, padding: '13px 15px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ font: `600 11px/1 ${FONT}`, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>
              Average Margin
            </span>
            <span style={{ font: `700 21px/1 ${MONO}`, color: avgMargin >= 15 ? 'var(--ok)' : avgMargin >= 0 ? 'var(--warn)' : 'var(--bad)' }}>
              {avgMargin.toFixed(1)}%
            </span>
            <span style={{ font: `400 11px/1.3 ${FONT}`, color: 'var(--ink-3)' }}>average profit margin</span>
          </div>
        </div>
      ) : null}

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
                      background: isProfitIncomplete(row)
                        ? 'var(--warn-soft)'
                        : row.netProfit >= 0
                          ? 'var(--ok-soft)'
                          : 'var(--bad-soft)',
                      color: netProfitColor(row),
                    }}
                  >
                    <DcIcon name="icon-calculator" size={15} />
                  </span>
                  <span className="dc-mobile-list-card__copy">
                    <span className="dc-mobile-list-card__title">{row.orderNumber}</span>
                    <span className="dc-mobile-list-card__sub">
                      {new Date(row.deliveredAt).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                      })}
                      {isProfitIncomplete(row)
                        ? ' · incomplete'
                        : row.marginPct == null
                          ? ''
                          : ` · ${row.marginPct}% margin`}
                    </span>
                  </span>
                  <span
                    className="dc-mobile-list-card__value"
                    style={{ color: netProfitColor(row) }}
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
                          {new Date(row.deliveredAt).toLocaleDateString('en-GB', {
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
                      <td style={{ ...td, color: netProfitColor(row), fontWeight: 700 }}>
                        {formatTaka(row.netProfit)}
                      </td>
                      <td style={{ ...td, color: isProfitIncomplete(row) ? 'var(--warn)' : 'var(--ink)' }}>
                        {displayMargin(row)}
                      </td>
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
          onNavigate={(href) => router.push(href)}
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
  onNavigate,
}: {
  loading: boolean
  error: unknown
  row: OrderProfitRow | OrderProfitDetail | null
  onClose: () => void
  onNavigate: (href: string) => void
}) {
  const [mounted, setMounted] = useState(false)
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
      [isProfitIncomplete(row) ? 'Net (incomplete)' : 'Net profit', row.netProfit],
    ] as Array<[string, number]>
  }, [row])

  const incomplete = row ? isProfitIncomplete(row) : false

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (error && !row) {
      toastFail(error instanceof Error ? error.message : 'Could not load order profit.')
    }
  }, [error, row])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  if (!mounted) return null

  return createPortal(
    <>
      <div
        aria-hidden
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 120,
          background: 'var(--overlay)',
          animation: 'dc-fadein 140ms ease-out',
        }}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={row?.orderNumber ? `Order ${row.orderNumber}` : 'Order profit detail'}
        className="dc-finance-drawer"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          zIndex: 121,
          width: 'min(420px, 100vw)',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg)',
          borderLeft: '1px solid var(--line-2)',
          boxShadow: '-12px 0 40px rgba(0, 0, 0, 0.18)',
          animation: 'dc-slidein 200ms cubic-bezier(.22,.9,.3,1)',
          fontFamily: FONT,
        }}
      >
        <header
          style={{
            flex: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '14px 16px',
            borderBottom: '1px solid var(--line)',
            background: 'var(--surface)',
          }}
        >
          <strong style={{ flex: 1, minWidth: 0, font: `700 15px/1.2 ${MONO}`, letterSpacing: '-.01em' }}>
            {row?.orderNumber ?? 'Order'}
          </strong>
          <button type="button" onClick={onClose} style={financeGhostBtn} aria-label="Close drawer">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <DcIcon name="icon-x" size={14} /> Close
            </span>
          </button>
        </header>

        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
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
            <p style={{ color: 'var(--bad)', font: `500 13px/1.45 ${FONT}` }}>Order not found.</p>
          ) : (
            <>
              {row.incompleteReasons.length ? (
                <div style={{ display: 'grid', gap: 8 }}>
                  {row.incompleteReasons.map((reason) => {
                    const copy = INCOMPLETE_FIX[reason]
                    return (
                      <div
                        key={reason}
                        style={{
                          padding: '10px 12px',
                          borderRadius: 10,
                          border: '1px solid var(--warn-bd)',
                          background: 'var(--warn-soft)',
                        }}
                      >
                        <p
                          style={{
                            margin: 0,
                            font: `600 12.5px/1.45 ${FONT}`,
                            color: 'var(--warn)',
                          }}
                        >
                          {copy?.message ?? `Incomplete: ${reason}`}
                        </p>
                        {copy ? (
                          <button
                            type="button"
                            onClick={() => onNavigate(copy.fixHref)}
                            style={{
                              ...financeGhostBtn,
                              marginTop: 8,
                              borderColor: 'var(--warn-bd)',
                              color: 'var(--warn)',
                            }}
                          >
                            {copy.fixLabel}
                          </button>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              ) : null}

              <section style={{ ...card, padding: '12px 14px' }}>
                <div
                  style={{
                    font: `600 10.5px/1 ${FONT}`,
                    letterSpacing: '.09em',
                    textTransform: 'uppercase',
                    color: 'var(--ink-3)',
                    marginBottom: 10,
                  }}
                >
                  Profit breakdown
                </div>
                <div style={{ display: 'grid', gap: 0 }}>
                  {lines.map(([label, amount], index) => {
                    const isNet = label.startsWith('Net')
                    const isLast = index === lines.length - 1
                    const unsetCost =
                      incomplete && label === 'Product cost' && row.incompleteReasons.includes('missing_cost')
                    const unsetPack =
                      incomplete && label === 'Packaging' && row.incompleteReasons.includes('packaging_unset')
                    return (
                      <div
                        key={label}
                        className="dc-finance-drawer__row"
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'minmax(0, 1fr) auto',
                          alignItems: 'center',
                          gap: 12,
                          padding: '9px 0',
                          borderBottom: isLast ? 0 : '1px solid var(--line)',
                          marginTop: isNet ? 4 : 0,
                          paddingTop: isNet ? 12 : 9,
                        }}
                      >
                        <span
                          style={{
                            color: isNet ? 'var(--ink)' : 'var(--ink-2)',
                            font: `${isNet ? 600 : 500} 13px/1.35 ${FONT}`,
                          }}
                        >
                          {label}
                        </span>
                        <span
                          style={{
                            font: `700 13px/1 ${MONO}`,
                            color: unsetCost || unsetPack
                              ? 'var(--warn)'
                              : isNet
                                ? netProfitColor(row)
                                : 'var(--ink)',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {unsetCost || unsetPack ? 'Not set' : formatTaka(amount)}
                        </span>
                      </div>
                    )
                  })}
                </div>
                {!incomplete && row.marginPct != null ? (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 12,
                      marginTop: 10,
                      paddingTop: 10,
                      borderTop: '1px dashed var(--line)',
                    }}
                  >
                    <span style={{ font: `600 11px/1 ${FONT}`, letterSpacing: '.08em', color: 'var(--ink-3)' }}>
                      MARGIN
                    </span>
                    <span style={{ font: `700 13px/1 ${MONO}`, color: 'var(--ink)' }}>{row.marginPct}%</span>
                  </div>
                ) : null}
              </section>

              {detail?.items?.length ? (
                <section>
                  <div
                    style={{
                      font: `600 10.5px/1 ${FONT}`,
                      letterSpacing: '.09em',
                      textTransform: 'uppercase',
                      color: 'var(--ink-3)',
                      marginBottom: 8,
                    }}
                  >
                    Line items
                  </div>
                  <div style={{ display: 'grid', gap: 8 }}>
                    {detail.items.map((item, i) => (
                      <div key={`${item.sku ?? item.productName}-${i}`} style={{ ...card, padding: '10px 12px' }}>
                        <div style={{ font: `600 13px/1.3 ${FONT}`, color: 'var(--ink)' }}>{item.productName}</div>
                        <div style={{ marginTop: 4, font: `500 12px/1.45 ${FONT}`, color: 'var(--ink-3)' }}>
                          {item.quantity} × {formatTaka(item.unitPrice)}
                          {item.incomplete
                            ? ' · missing cost'
                            : ` · cost ${formatTaka((item.costPrice ?? 0) * item.quantity)}`}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}
            </>
          )}
        </div>
      </aside>
    </>,
    document.body,
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
