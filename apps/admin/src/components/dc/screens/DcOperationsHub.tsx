'use client'

import { useRouter } from 'next/navigation'
import { useMemo } from 'react'

import { DcIcon } from '@/components/dc/DcIcon'
import { DcPageHead } from '@/components/dc/DcPageHead'
import { DcScreenProvider } from '@/components/dc/DcScreenContext'
import { DcErrorState, DcLoadingState } from '@/components/dc/blocks/DcStates'
import type { DcBlock } from '@/components/dc/blocks/types'
import { dcPageStatus } from '@/components/dc/page-status'
import { FONT, MONO, formatTaka, toneStyle, type DcTone } from '@/components/dc/tokens'
import {
  useCourierStats,
  useOrders,
  useProcurementOverview,
  useReturns,
  useWmsOverview,
} from '@/lib/api/hooks'
import { useAdminConnection } from '@/lib/hooks/use-admin-connection'

const card = {
  border: '1px solid var(--line)',
  borderRadius: 14,
  background: 'var(--surface)',
  backgroundImage: 'var(--card-sheen)',
} as const

const capsLabel = {
  font: `600 11px/1 ${FONT}`,
  letterSpacing: '.09em',
  textTransform: 'uppercase' as const,
  color: 'var(--ink-3)',
}

/** Orders sitting in the shop before anything has been handed to a courier. */
const PRE_SHIP = ['PENDING', 'CONFIRMED', 'PROCESSING', 'PACKED']
const OPEN_PO = ['DRAFT', 'PENDING', 'ORDERED', 'PARTIAL']
const OPEN_RMA = ['pending', 'approved', 'received']

interface Decision {
  key: string
  title: string
  count: number
  tone: DcTone
  detail: string
  why: string
  cta: string
  href: string
}

export function DcOperationsHub() {
  const router = useRouter()
  return (
    <DcScreenProvider screen="operations" onNavigate={(next) => router.push(`/dashboard/${next}`)}>
      <DcOperationsHubBody />
    </DcScreenProvider>
  )
}

function DcOperationsHubBody() {
  const router = useRouter()
  const orders = useOrders({ limit: 50 })
  const courier = useCourierStats()
  const wms = useWmsOverview()
  const proc = useProcurementOverview()
  const returns = useReturns()
  const { api } = useAdminConnection(25_000)

  const queries = [orders, courier, wms, proc, returns]
  const loading = queries.some((q) => q.isLoading)
  // A hub aggregates five endpoints. One failure greys one card, not the page —
  // the page only errors out when nothing at all came back.
  const allFailed = queries.every((q) => q.error)
  const pageStatus = dcPageStatus(queries, api.pulse)

  const orderRows = useMemo(() => orders.data?.orders ?? [], [orders.data])
  const toPack = orderRows.filter((o) => PRE_SHIP.includes(o.status.toUpperCase())).length
  const codRisk = orderRows.filter((o) => o.isCodRisk).length

  const byStatus = courier.data?.byStatus ?? []
  const shipmentsLive = byStatus
    .filter((s) => !['DELIVERED', 'RETURNED', 'CANCELLED', 'FAILED'].includes(s.status.toUpperCase()))
    .reduce((s, x) => s + x._count, 0)
  const failedShipments = courier.data?.recentFailed.length ?? 0

  const stock = wms.data?.stockSummary
  const transfersOpen = (wms.data?.transfers ?? []).filter((t) =>
    ['PENDING', 'IN_TRANSIT'].includes(t.status.toUpperCase()),
  ).length

  const openPos = (proc.data?.orders ?? []).filter((o) => OPEN_PO.includes(o.status.toUpperCase()))
  const supplierDue = (proc.data?.suppliers ?? []).reduce((s, x) => s + Number(x.dueAmount || 0), 0)

  const rmaRows = returns.data ?? []
  const openRma = rmaRows.filter((r) => OPEN_RMA.includes(r.status))
  const rmaExposure = openRma.reduce((s, r) => s + Number(r.amount || 0), 0)

  const decisions: Decision[] = [
    ...(failedShipments > 0
      ? [
          {
            key: 'courier-failed',
            title: 'Courier bookings failed',
            count: failedShipments,
            tone: 'bad' as DcTone,
            detail: courier.data?.recentFailed
              .slice(0, 2)
              .map((f) => `${f.order.invoiceNumber} · ${f.provider}`)
              .join(' · ') ?? '',
            why: 'The customer thinks it shipped. Nothing is moving until the booking is retried.',
            cta: 'Open Courier Hub',
            href: '/dashboard/courier-hub',
          },
        ]
      : []),
    ...(toPack > 0
      ? [
          {
            key: 'pack',
            title: 'Orders waiting to be packed',
            count: toPack,
            tone: toPack > 15 ? ('warn' as DcTone) : ('info' as DcTone),
            detail: codRisk > 0 ? `${codRisk} flagged COD risk` : 'no COD flags in this batch',
            why: 'Same-day cut-off is what customers judge you on. Pack oldest first.',
            cta: 'Open Packing Station',
            href: '/dashboard/packing-station',
          },
        ]
      : []),
    ...(openRma.length > 0
      ? [
          {
            key: 'rma',
            title: 'Returns waiting on a decision',
            count: openRma.length,
            tone: 'warn' as DcTone,
            detail: `${formatTaka(rmaExposure)} of refund exposure`,
            why: 'Until you approve or reject, the customer is chasing support.',
            cta: 'Open Returns / RMA',
            href: '/dashboard/returns-rma',
          },
        ]
      : []),
    ...(transfersOpen > 0
      ? [
          {
            key: 'transfers',
            title: 'Stock transfers in limbo',
            count: transfersOpen,
            tone: 'vio' as DcTone,
            detail: 'pending or in transit between warehouses',
            why: 'In-transit stock is unsellable on both sides until it is received.',
            cta: 'Open Warehouse & Stock',
            href: '/dashboard/wms/overview',
          },
        ]
      : []),
    ...(openPos.length > 0
      ? [
          {
            key: 'po',
            title: 'Purchase orders not received',
            count: openPos.length,
            tone: 'info' as DcTone,
            detail: `${formatTaka(openPos.reduce((s, o) => s + Number(o.total || 0), 0))} committed`,
            why: 'Cash is out and nothing is on the shelf. Chase the supplier or file the GRN.',
            cta: 'Open Purchase Orders',
            href: '/dashboard/procurement/purchase-orders',
          },
        ]
      : []),
  ]

  const modules: Array<{
    label: string
    icon: string
    href: string
    metric: string
    metricLabel: string
    note: string
    failed: boolean
  }> = [
    {
      label: 'Packing Station',
      icon: 'icon-package',
      href: '/dashboard/packing-station',
      metric: orders.error ? '—' : String(toPack),
      metricLabel: 'to pack',
      note: 'Pick, pack, and print the label for each paid order.',
      failed: Boolean(orders.error),
    },
    {
      label: 'Courier Hub',
      icon: 'icon-truck',
      href: '/dashboard/courier-hub',
      metric: courier.error ? '—' : String(shipmentsLive),
      metricLabel: 'in flight',
      note: 'Book, retry, and track every consignment across providers.',
      failed: Boolean(courier.error),
    },
    {
      label: 'Warehouse & Stock',
      icon: 'icon-warehouse',
      href: '/dashboard/wms/overview',
      metric: wms.error ? '—' : String(stock?.available ?? 0),
      metricLabel: 'units available',
      note: 'Bins, movements, and transfers — the ledger behind every stock number.',
      failed: Boolean(wms.error),
    },
    {
      label: 'Purchase Orders',
      icon: 'icon-clipboard-list',
      href: '/dashboard/procurement/purchase-orders',
      metric: proc.error ? '—' : formatTaka(supplierDue),
      metricLabel: 'owed to suppliers',
      note: 'Raise POs, and file the GRN that turns them into stock.',
      failed: Boolean(proc.error),
    },
    {
      label: 'Returns / RMA',
      icon: 'icon-rotate-ccw',
      href: '/dashboard/returns-rma',
      metric: returns.error ? '—' : String(openRma.length),
      metricLabel: 'open returns',
      note: 'Approve, receive, and refund what comes back.',
      failed: Boolean(returns.error),
    },
    {
      label: 'Inventory',
      icon: 'icon-boxes',
      href: '/dashboard/inventory',
      metric: wms.error ? '—' : String(stock?.reserved ?? 0),
      metricLabel: 'units reserved',
      note: 'Reorder points and low-stock decisions per SKU.',
      failed: Boolean(wms.error),
    },
  ]

  const chain: Array<{ icon: string; text: string }> = [
    { icon: 'icon-shopping-cart', text: 'An order is placed and reserves stock — reserved units leave the sellable pool.' },
    { icon: 'icon-package', text: 'Packing Station picks it, which turns reserved into shipped in the ledger.' },
    { icon: 'icon-truck', text: 'Courier Hub books the consignment. A failed booking stops the chain here.' },
    { icon: 'icon-rotate-ccw', text: 'A return comes back through RMA and lands as available or damaged stock.' },
    { icon: 'icon-clipboard-list', text: 'Low stock drives a purchase order; the GRN puts the units back on the shelf.' },
  ]

  const skeleton: DcBlock[] = [
    { t: 'kpis' } as DcBlock,
    { t: 'decide', title: '', items: [] } as DcBlock,
    { t: 'cards', w: 'main', title: '', items: [] } as DcBlock,
    { t: 'list', w: 'side', title: '', items: [] } as DcBlock,
  ]

  const refetchAll = () => {
    void orders.refetch()
    void courier.refetch()
    void wms.refetch()
    void proc.refetch()
    void returns.refetch()
  }

  return (
    <>
      <DcPageHead
        crumbGroup="Operations"
        title="Operations Hub"
        statusLabel={pageStatus.label}
        statusTone={pageStatus.tone}
        syncLabel={
          queries.some((q) => q.isFetching)
            ? 'syncing…'
            : `${decisions.length} thing${decisions.length === 1 ? '' : 's'} need you`
        }
        syncing={queries.some((q) => q.isFetching)}
        onSync={refetchAll}
        actions={[
          {
            label: 'Packing Station',
            icon: 'icon-package',
            variant: 'primary',
            onClick: () => router.push('/dashboard/packing-station'),
          },
        ]}
      />

      {loading ? (
        <DcLoadingState blocks={skeleton} />
      ) : allFailed ? (
        <DcErrorState
          error={`GET /admin/orders, /admin/courier/stats/overview, /commerce-os/wms/overview, /commerce-os/procurement/overview, /admin/commerce-finance/returns → ${orders.error instanceof Error ? orders.error.message : 'all five requests failed'}`}
          hint="Every feed this hub reads is down at once — that usually means the API, not the modules."
          onRetry={refetchAll}
        />
      ) : (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(206px, 1fr))',
              gap: 12,
            }}
          >
            <Kpi
              label="Waiting to pack"
              value={orders.error ? '—' : String(toPack)}
              sub={orders.error ? 'GET /admin/orders failed' : 'paid orders still in the shop'}
              color={toPack > 15 ? 'var(--warn)' : undefined}
            />
            <Kpi
              label="In flight"
              value={courier.error ? '—' : String(shipmentsLive)}
              sub={
                courier.error
                  ? 'GET /admin/courier/stats/overview failed'
                  : `${failedShipments} booking${failedShipments === 1 ? '' : 's'} failed`
              }
              color={failedShipments > 0 ? 'var(--bad)' : undefined}
            />
            <Kpi
              label="Sellable stock"
              value={wms.error ? '—' : String(stock?.available ?? 0)}
              sub={
                wms.error
                  ? 'GET /commerce-os/wms/overview failed'
                  : `${stock?.reserved ?? 0} reserved · ${stock?.damaged ?? 0} damaged`
              }
            />
            <Kpi
              label="Refund exposure"
              value={returns.error ? '—' : formatTaka(rmaExposure)}
              sub={
                returns.error
                  ? 'GET /admin/commerce-finance/returns failed'
                  : `${openRma.length} open return${openRma.length === 1 ? '' : 's'}`
              }
              color={rmaExposure > 0 ? 'var(--warn)' : undefined}
            />
          </div>

          <div style={{ ...card, overflow: 'hidden' }}>
            <div
              style={{
                padding: '13px 16px',
                borderBottom: '1px solid var(--line)',
                display: 'flex',
                alignItems: 'baseline',
                gap: 9,
                flexWrap: 'wrap',
              }}
            >
              <span style={{ font: `600 13.5px/1 ${FONT}`, color: 'var(--ink)' }}>
                Where the queue is stuck
              </span>
              <span
                style={{ flex: 1, minWidth: 60, font: `400 11.5px/1.4 ${FONT}`, color: 'var(--ink-3)' }}
              >
                worst first — each card opens the module that clears it
              </span>
            </div>
            {decisions.length === 0 ? (
              <div
                style={{
                  padding: '34px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 8,
                  textAlign: 'center',
                }}
              >
                <DcIcon name="icon-check-circle" size={20} color="var(--ok)" />
                <span style={{ font: `600 13px/1.4 ${FONT}`, color: 'var(--ink)' }}>
                  Nothing is stuck right now
                </span>
                <span
                  style={{
                    maxWidth: 420,
                    font: `400 12px/1.55 ${FONT}`,
                    color: 'var(--ink-3)',
                    textWrap: 'pretty',
                  }}
                >
                  No failed bookings, no unpacked orders, no open returns, transfers, or purchase
                  orders across the five ops feeds.
                </span>
              </div>
            ) : (
              <div
                style={{
                  padding: 12,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))',
                  gap: 10,
                }}
              >
                {decisions.map((d) => {
                  const tone = toneStyle(d.tone)
                  return (
                    <div
                      key={d.key}
                      style={{
                        border: '1px solid var(--line)',
                        borderLeft: `3px solid ${tone.fg}`,
                        borderRadius: 11,
                        background: 'var(--surface-2)',
                        padding: '12px 13px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 9,
                      }}
                    >
                      <span style={{ font: `600 13px/1.35 ${FONT}`, color: 'var(--ink)' }}>
                        {d.title}
                      </span>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'baseline',
                          gap: 8,
                          flexWrap: 'wrap',
                          padding: '9px 10px',
                          border: '1px solid var(--line)',
                          borderRadius: 9,
                          background: 'var(--surface)',
                        }}
                      >
                        <span style={{ font: `700 17px/1 ${MONO}`, color: tone.fg }}>{d.count}</span>
                        <span style={{ font: `500 11.5px/1.4 ${FONT}`, color: 'var(--ink-3)' }}>
                          {d.detail}
                        </span>
                      </div>
                      <span
                        style={{
                          font: `400 11.5px/1.55 ${FONT}`,
                          color: 'var(--ink-3)',
                          textWrap: 'pretty',
                        }}
                      >
                        {d.why}
                      </span>
                      <button
                        type="button"
                        onClick={() => router.push(d.href)}
                        style={{
                          alignSelf: 'flex-start',
                          height: 30,
                          padding: '0 12px',
                          borderRadius: 8,
                          border: '1px solid var(--violet-solid)',
                          background: 'var(--violet-solid)',
                          color: 'var(--on-violet)',
                          cursor: 'pointer',
                          font: `600 11.5px/1 ${FONT}`,
                        }}
                      >
                        {d.cta}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 16,
              alignItems: 'flex-start',
              width: '100%',
            }}
          >
            <div style={{ flex: '1 1 56%', minWidth: 340, maxWidth: '100%' }}>
              <div style={{ ...card, overflow: 'hidden' }}>
                <div style={{ padding: '12px 15px', borderBottom: '1px solid var(--line)' }}>
                  <span style={{ font: `600 13.5px/1.3 ${FONT}`, color: 'var(--ink)' }}>
                    Ops modules
                  </span>
                </div>
                <div
                  style={{
                    padding: 12,
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                    gap: 10,
                  }}
                >
                  {modules.map((m) => (
                    <button
                      key={m.href}
                      type="button"
                      onClick={() => router.push(m.href)}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                        padding: '12px 13px',
                        border: '1px solid var(--line)',
                        borderRadius: 11,
                        background: 'var(--surface-2)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        opacity: m.failed ? 0.6 : 1,
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                        <span
                          style={{
                            display: 'grid',
                            placeItems: 'center',
                            width: 28,
                            height: 28,
                            flex: 'none',
                            borderRadius: 8,
                            border: '1px solid var(--line)',
                            background: 'var(--surface)',
                            color: 'var(--ink-2)',
                          }}
                        >
                          <DcIcon name={m.icon} size={13} />
                        </span>
                        <span
                          style={{ flex: 1, font: `600 12.5px/1.3 ${FONT}`, color: 'var(--ink)' }}
                        >
                          {m.label}
                        </span>
                        <DcIcon name="icon-arrow-right" size={13} color="var(--ink-3)" />
                      </span>
                      <span style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                        <span style={{ font: `700 16px/1 ${MONO}`, color: 'var(--ink)' }}>
                          {m.metric}
                        </span>
                        <span style={{ font: `500 11px/1.3 ${FONT}`, color: 'var(--ink-3)' }}>
                          {m.failed ? 'feed unavailable' : m.metricLabel}
                        </span>
                      </span>
                      <span
                        style={{
                          font: `400 11.5px/1.5 ${FONT}`,
                          color: 'var(--ink-3)',
                          textWrap: 'pretty',
                        }}
                      >
                        {m.note}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ flex: '1 1 28%', minWidth: 290, maxWidth: '100%' }}>
              <div style={{ ...card, padding: '6px 16px 10px' }}>
                <div style={{ padding: '12px 0 9px' }}>
                  <span style={{ font: `600 13.5px/1.3 ${FONT}`, color: 'var(--ink)' }}>
                    How one unit moves
                  </span>
                </div>
                {chain.map((c, i) => (
                  <div
                    key={c.text}
                    style={{
                      display: 'flex',
                      gap: 11,
                      padding: '10px 0',
                      borderTop: '1px solid var(--line)',
                    }}
                  >
                    <span
                      style={{
                        display: 'grid',
                        placeItems: 'center',
                        width: 26,
                        height: 26,
                        flex: 'none',
                        borderRadius: 8,
                        border: '1px solid var(--line)',
                        background: 'var(--surface-2)',
                        color: 'var(--ink-2)',
                      }}
                    >
                      <DcIcon name={c.icon} size={12} />
                    </span>
                    <span
                      style={{
                        flex: 1,
                        minWidth: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 3,
                      }}
                    >
                      <span style={{ font: `600 10.5px/1 ${MONO}`, color: 'var(--ink-3)' }}>
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span
                        style={{
                          font: `400 12px/1.5 ${FONT}`,
                          color: 'var(--ink-2)',
                          textWrap: 'pretty',
                        }}
                      >
                        {c.text}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}

function Kpi({
  label,
  value,
  sub,
  color,
}: {
  label: string
  value: string
  sub: string
  color?: string | undefined
}) {
  return (
    <div
      style={{ ...card, padding: '14px 15px 13px', display: 'flex', flexDirection: 'column', gap: 8 }}
    >
      <span style={capsLabel}>{label}</span>
      <span
        style={{ font: `700 25px/1 ${FONT}`, letterSpacing: '-.025em', color: color ?? 'var(--ink)' }}
      >
        {value}
      </span>
      <span style={{ font: `400 11.5px/1.35 ${FONT}`, color: 'var(--ink-3)' }}>{sub}</span>
    </div>
  )
}
