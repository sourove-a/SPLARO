'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useMemo, useState } from 'react'

import { DcIcon } from '@/components/dc/DcIcon'
import { DcPageHead } from '@/components/dc/DcPageHead'
import { dcPageStatus } from '@/components/dc/page-status'
import { DcScreenProvider } from '@/components/dc/DcScreenContext'
import { DcOrderDrawer } from '@/components/orders/DcOrderDrawer'
import { DcEmptyState, DcErrorState, DcLoadingState } from '@/components/dc/blocks/DcStates'
import type { DcBlock } from '@/components/dc/blocks/types'
import { FONT, MONO, formatTaka, statusToneStyle, toneStyle } from '@/components/dc/tokens'
import { downloadCsv } from '@/lib/admin/admin-actions'
import { toastOk, toastFail } from '@/lib/admin/feedback'
import { useOrders } from '@/lib/api/hooks'
import { useAdminConnection } from '@/lib/hooks/use-admin-connection'
import { formatBdPhone, phoneMatches } from '@/lib/format/bd-phone'
import type { ApiOrder } from '@/lib/api/orders'

/** Fulfilment stages, in the order the floor works them. */
const STAGES = [
  'All',
  'Pending',
  'Confirmed',
  'Processing',
  'Packed',
  'Shipped',
  'Delivered',
] as const
type Stage = (typeof STAGES)[number]

const card = {
  border: '1px solid var(--line)',
  borderRadius: 14,
  background: 'var(--surface)',
  backgroundImage: 'var(--card-sheen)',
} as const

const th = {
  textAlign: 'left' as const,
  padding: '9px 14px',
  font: `600 10.5px/1 ${FONT}`,
  letterSpacing: '.09em',
  textTransform: 'uppercase' as const,
  color: 'var(--ink-3)',
  borderBottom: '1px solid var(--line)',
  whiteSpace: 'nowrap' as const,
}

function stageFromUrl(raw: string | null): Stage | null {
  if (!raw) return null
  const hit = STAGES.find((s) => s.toUpperCase() === raw.toUpperCase())
  return hit ?? null
}

function titleCase(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}

function courierLabel(o: ApiOrder): { text: string; color: string } {
  if (o.courier?.consignmentId || o.courier?.trackingCode) {
    return { text: o.courier.provider ?? 'Booked', color: 'var(--ink-2)' }
  }
  if (o.status.toUpperCase() === 'PACKED') {
    return { text: 'Ready to book', color: 'var(--warn)' }
  }
  return { text: '—', color: 'var(--ink-3)' }
}

export function DcOrders() {
  const router = useRouter()
  return (
    <DcScreenProvider screen="orders" onNavigate={(next) => router.push(`/dashboard/${next}`)}>
      <Suspense fallback={<DcLoadingState blocks={[{ t: 'table', title: '', cols: [], rows: [] }]} />}>
        <DcOrdersBody />
      </Suspense>
    </DcScreenProvider>
  )
}

function DcOrdersBody() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [stage, setStage] = useState<Stage>('All')
  const [pay, setPay] = useState('All')
  const [query, setQuery] = useState('')
  const [openOrder, setOpenOrder] = useState<string | null>(null)

  useEffect(() => {
    const nextStage = stageFromUrl(searchParams.get('status'))
    if (nextStage) setStage(nextStage)
    const search = searchParams.get('search')?.trim()
    if (search) setQuery(search)
  }, [searchParams])

  const orders = useOrders({ limit: 100 })
  const { api } = useAdminConnection(25_000)
  const pageStatus = dcPageStatus([orders], api.pulse)
  const all = useMemo(() => orders.data?.orders ?? [], [orders.data])

  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = { All: all.length }
    for (const s of STAGES) {
      if (s === 'All') continue
      counts[s] = all.filter((o) => o.status.toUpperCase() === s.toUpperCase()).length
    }
    return counts
  }, [all])

  // Payment chips are derived from what the store actually takes, not hardcoded.
  const payMethods = useMemo(
    () => ['All', ...Array.from(new Set(all.map((o) => o.paymentMethod).filter(Boolean)))],
    [all],
  )

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return all.filter((o) => {
      if (stage !== 'All' && o.status.toUpperCase() !== stage.toUpperCase()) return false
      if (pay !== 'All' && o.paymentMethod !== pay) return false
      if (!q) return true
      if (phoneMatches(o.shippingPhone, q)) return true
      return (
        o.invoiceNumber.toLowerCase().includes(q) || o.shippingName.toLowerCase().includes(q)
      )
    })
  }, [all, stage, pay, query])

  const skeleton: DcBlock[] = [
    { t: 'seg', items: [] },
    { t: 'table', title: '', cols: [], rows: [] },
  ]

  return (
    <>
      <DcPageHead
        crumbGroup="Commerce"
        title="Orders"
        statusLabel={pageStatus.label}
        statusTone={pageStatus.tone}
        syncLabel={orders.isFetching ? 'syncing…' : `${orders.data?.total ?? 0} in total`}
        syncing={orders.isFetching}
        onSync={() => void orders.refetch()}
        actions={[
          {
            label: 'Export',
            icon: 'icon-download',
            onClick: () => {
              if (rows.length === 0) {
                toastFail('No orders to export — load live data first.')
                return
              }
              const date = new Date().toISOString().slice(0, 10)
              downloadCsv(`splaro-orders-${date}.csv`, [
                ['Order', 'Customer', 'Phone', 'Payment', 'Status', 'Total', 'Created'],
                ...rows.map((o) => [
                  o.invoiceNumber,
                  o.shippingName,
                  o.shippingPhone,
                  o.paymentMethod,
                  o.status,
                  String(o.total),
                  o.createdAt,
                ]),
              ])
              toastOk(`Exported ${rows.length} order${rows.length === 1 ? '' : 's'}.`)
            },
          },
          {
            label: 'New order',
            icon: 'icon-plus',
            variant: 'primary',
            onClick: () => router.push('/dashboard/orders/new'),
          },
        ]}
      />

      {orders.isLoading ? (
        <DcLoadingState blocks={skeleton} />
      ) : orders.error ? (
        <DcErrorState
          error={`GET /admin/orders → ${orders.error instanceof Error ? orders.error.message : '500 Internal Server Error'}`}
          hint="The shell is fine — only the orders list failed to load."
          onRetry={() => {
            void orders.refetch()
          }}
        />
      ) : all.length === 0 ? (
        <DcEmptyState
          icon="icon-inbox"
          title="No orders yet"
          body="Orders land here the moment a customer checks out. Until then the packing queue stays empty."
          cta="Create an order"
          onCta={() => router.push('/dashboard/orders/new')}
        />
      ) : (
        <>
          <MobileOrdersList
            orders={rows}
            stage={stage}
            counts={stageCounts}
            query={query}
            onQuery={setQuery}
            onStage={setStage}
            onOpen={(id) => setOpenOrder(id)}
          />

          <div className="dc-desktop-route-panel">
          <StageStrip stage={stage} counts={stageCounts} onSelect={setStage} />

          <div style={{ ...card, overflow: 'auto' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '11px 14px',
                borderBottom: '1px solid var(--line)',
                flexWrap: 'wrap',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  height: 34,
                  padding: '0 11px',
                  borderRadius: 9,
                  border: '1px solid var(--line)',
                  background: 'var(--surface-2)',
                  minWidth: 230,
                }}
              >
                <DcIcon name="icon-search" size={14} color="var(--ink-3)" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Order ID, phone, customer…"
                  aria-label="Search orders"
                  style={{
                    flex: 1,
                    border: 0,
                    background: 'transparent',
                    outline: 'none',
                    color: 'var(--ink)',
                    font: `400 13px/1 ${FONT}`,
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {payMethods.map((p) => {
                  const on = p === pay
                  const t = toneStyle('vio')
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPay(p)}
                      style={{
                        height: 30,
                        padding: '0 11px',
                        borderRadius: 8,
                        cursor: 'pointer',
                        font: `600 12px/1 ${FONT}`,
                        border: `1px solid ${on ? t.bd : 'var(--line)'}`,
                        background: on ? t.bg : 'var(--surface-2)',
                        color: on ? t.fg : 'var(--ink-2)',
                      }}
                    >
                      {p === 'All' ? 'All payments' : p}
                    </button>
                  )
                })}
              </div>

              <div style={{ flex: 1 }} />
              <span style={{ font: `500 12px/1 ${FONT}`, color: 'var(--ink-3)' }}>
                {rows.length} of {all.length} orders
              </span>
            </div>

            {rows.length === 0 ? (
              <div
                style={{
                  padding: '64px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <span
                  style={{
                    display: 'grid',
                    placeItems: 'center',
                    width: 46,
                    height: 46,
                    borderRadius: 12,
                    border: '1px solid var(--line)',
                    background: 'var(--surface-2)',
                    color: 'var(--ink-3)',
                  }}
                >
                  <DcIcon name="icon-inbox" size={20} />
                </span>
                <span style={{ font: `600 14.5px/1 ${FONT}`, color: 'var(--ink)' }}>
                  No orders match these filters
                </span>
                <span
                  style={{
                    font: `400 13px/1.5 ${FONT}`,
                    color: 'var(--ink-3)',
                    textAlign: 'center',
                    maxWidth: 320,
                  }}
                >
                  Try clearing the payment filter or searching a different order ID.
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setPay('All')
                    setStage('All')
                    setQuery('')
                  }}
                  style={{
                    height: 32,
                    padding: '0 14px',
                    borderRadius: 8,
                    border: '1px solid var(--line-2)',
                    background: 'var(--surface)',
                    color: 'var(--ink)',
                    cursor: 'pointer',
                    font: `600 12.5px/1 ${FONT}`,
                  }}
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={th}>Order</th>
                    <th style={th}>Customer</th>
                    <th style={th}>Payment</th>
                    <th style={th}>Status</th>
                    <th style={th}>Courier</th>
                    <th style={{ ...th, textAlign: 'right' }}>Total</th>
                    <th style={{ ...th, textAlign: 'right' }}>Placed</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((o) => {
                    const tone = statusToneStyle(titleCase(o.status))
                    const courier = courierLabel(o)
                    return (
                      <tr
                        key={o.id}
                        onClick={() => setOpenOrder(o.id)}
                        className="dc-hover-surface"
                        style={{ borderBottom: '1px solid var(--line)', cursor: 'pointer' }}
                      >
                        <td style={{ padding: '11px 14px', font: `600 12.5px/1 ${MONO}`, color: 'var(--ink)' }}>
                          {o.invoiceNumber}
                        </td>
                        <td style={{ padding: '11px 14px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            <span style={{ font: `500 13px/1 ${FONT}`, color: 'var(--ink)' }}>
                              {o.shippingName}
                            </span>
                            <span style={{ font: `400 11.5px/1 ${MONO}`, color: 'var(--ink-3)' }}>
                              {formatBdPhone(o.shippingPhone)}
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: '11px 14px' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: '3px 8px',
                              borderRadius: 6,
                              font: `600 11px/1 ${FONT}`,
                              border: '1px solid var(--line)',
                              background: 'var(--surface-2)',
                              color: 'var(--ink-2)',
                            }}
                          >
                            {o.paymentMethod}
                          </span>
                        </td>
                        <td style={{ padding: '11px 14px' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 5,
                              padding: '3px 8px',
                              borderRadius: 6,
                              font: `600 11px/1 ${FONT}`,
                              border: `1px solid ${tone.bd}`,
                              background: tone.bg,
                              color: tone.fg,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            <span
                              style={{
                                width: 5,
                                height: 5,
                                borderRadius: 99,
                                background: 'currentColor',
                              }}
                            />
                            {titleCase(o.status)}
                          </span>
                        </td>
                        <td
                          style={{
                            padding: '11px 14px',
                            font: `500 12px/1 ${FONT}`,
                            color: courier.color,
                          }}
                        >
                          {courier.text}
                        </td>
                        <td
                          style={{
                            padding: '11px 14px',
                            textAlign: 'right',
                            font: `600 13px/1 ${MONO}`,
                            color: 'var(--ink)',
                          }}
                        >
                          {formatTaka(Number(o.total))}
                        </td>
                        <td
                          style={{
                            padding: '11px 14px',
                            textAlign: 'right',
                            font: `400 12px/1 ${FONT}`,
                            color: 'var(--ink-3)',
                          }}
                        >
                          {new Date(o.createdAt).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                          })}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
          </div>
        </>
      )}
      <DcOrderDrawer orderId={openOrder} onClose={() => setOpenOrder(null)} />
    </>
  )
}

function MobileOrdersList({
  orders,
  stage,
  counts,
  query,
  onQuery,
  onStage,
  onOpen,
}: {
  orders: ApiOrder[]
  stage: Stage
  counts: Record<string, number>
  query: string
  onQuery: (q: string) => void
  onStage: (s: Stage) => void
  onOpen: (id: string) => void
}) {
  return (
    <div className="dc-mobile-route-panel" aria-label="Orders">
      <label className="dc-mobile-filter">
        <DcIcon name="icon-search" size={15} />
        <input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Order, phone, name…"
          aria-label="Search orders"
        />
      </label>

      <div className="dc-mobile-chips" role="tablist" aria-label="Order stages">
        {STAGES.map((s) => {
          const on = s === stage
          const count = s === 'All' ? (counts.All ?? orders.length) : (counts[s] ?? 0)
          return (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={on}
              className="dc-mobile-chip"
              data-on={on ? 'true' : 'false'}
              onClick={() => onStage(s)}
            >
              {s}
              <span className="dc-mobile-chip__n">{count}</span>
            </button>
          )
        })}
      </div>

      {orders.length === 0 ? (
        <div
          style={{
            padding: '42px 18px',
            border: '1px solid var(--line)',
            borderRadius: 12,
            background: 'var(--surface)',
            color: 'var(--ink-3)',
            textAlign: 'center',
            font: `500 12.5px/1.5 ${FONT}`,
          }}
        >
          No orders match current filters.
        </div>
      ) : (
        <div className="dc-mobile-list">
          {orders.map((order) => {
            const status = titleCase(order.status)
            const tone = statusToneStyle(status)
            return (
              <button
                key={order.id}
                type="button"
                className="dc-mobile-list-card"
                onClick={() => onOpen(order.id)}
              >
                <span
                  className="dc-mobile-list-card__icon"
                  style={{ background: tone.bg, color: tone.fg }}
                >
                  <DcIcon name="icon-shopping-bag" size={15} />
                </span>
                <span className="dc-mobile-list-card__copy">
                  <span className="dc-mobile-list-card__title">
                    {order.invoiceNumber} · {order.shippingName}
                  </span>
                  <span className="dc-mobile-list-card__sub">
                    {status} · {order.paymentMethod} · {formatBdPhone(order.shippingPhone || '')}
                  </span>
                </span>
                <span className="dc-mobile-list-card__value">
                  {formatTaka(Number(order.total))}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function StageStrip({
  stage,
  counts,
  onSelect,
}: {
  stage: Stage
  counts: Record<string, number>
  onSelect: (s: Stage) => void
}) {
  return (
    <div style={{ ...card, display: 'flex', gap: 8, padding: 4, overflowX: 'auto' }}>
      {STAGES.map((s) => {
        const on = s === stage
        return (
          <button
            key={s}
            type="button"
            onClick={() => onSelect(s)}
            style={{
              flex: 1,
              minWidth: 104,
              display: 'flex',
              flexDirection: 'column',
              gap: 5,
              padding: '10px 12px',
              borderRadius: 9,
              cursor: 'pointer',
              textAlign: 'left',
              border: `1px solid ${on ? 'var(--violet-bd)' : 'transparent'}`,
              background: on ? 'var(--violet-soft)' : 'transparent',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 99,
                  background: on ? 'var(--violet)' : 'var(--ink-3)',
                }}
              />
              <span
                style={{
                  font: `600 10.5px/1 ${FONT}`,
                  letterSpacing: '.08em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-3)',
                }}
              >
                {s}
              </span>
            </span>
            <span
              style={{
                font: `700 19px/1 ${FONT}`,
                letterSpacing: '-.02em',
                color: on ? 'var(--violet)' : 'var(--ink)',
              }}
            >
              {counts[s] ?? 0}
            </span>
          </button>
        )
      })}
    </div>
  )
}
