'use client'

import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

import { DcIcon } from '@/components/dc/DcIcon'
import { DcPageHead } from '@/components/dc/DcPageHead'
import { dcPageStatus } from '@/components/dc/page-status'
import { DcScreenProvider } from '@/components/dc/DcScreenContext'
import { DcErrorState, DcLoadingState } from '@/components/dc/blocks/DcStates'
import type { DcBlock } from '@/components/dc/blocks/types'
import { FONT, MONO, formatTaka, statusToneStyle, toneStyle, type DcTone } from '@/components/dc/tokens'
import { fetchProfitLoss } from '@/lib/api/finance'
import {
  useAdminSession,
  useDashboardInsights,
  useDashboardStats,
  useInventoryAlerts,
  useOrders,
  useProducts,
} from '@/lib/api/hooks'
import { useClientNow } from '@/components/dc/useClientNow'
import { useAdminConnection } from '@/lib/hooks/use-admin-connection'

/* ── shared surfaces ─────────────────────────────────────────────── */

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

const th = {
  textAlign: 'left' as const,
  padding: '9px 16px',
  font: `600 10.5px/1 ${FONT}`,
  letterSpacing: '.09em',
  textTransform: 'uppercase' as const,
  color: 'var(--ink-3)',
  borderBottom: '1px solid var(--line)',
  whiteSpace: 'nowrap' as const,
}

/** Fulfilment stages, in the order the floor works them. */
const PIPELINE = [
  { id: 'PENDING', label: 'Pending', dot: 'var(--warn)' },
  { id: 'CONFIRMED', label: 'Confirmed', dot: 'var(--info)' },
  { id: 'PROCESSING', label: 'Processing', dot: 'var(--info)' },
  { id: 'PACKED', label: 'Packed', dot: 'var(--violet)' },
  { id: 'SHIPPED', label: 'Shipped', dot: 'var(--info)' },
  { id: 'DELIVERED', label: 'Delivered', dot: 'var(--ok)' },
]

const RANGES = [
  { id: '7D', days: 7 },
  { id: '14D', days: 14 },
  { id: '30D', days: 30 },
] as const
type RangeId = (typeof RANGES)[number]['id']

interface TimelinePoint {
  label: string
  revenue: number
}

function titleCase(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}

function delta(v: number) {
  const r = Math.round(v * 10) / 10
  return `${r >= 0 ? '+' : '−'}${Math.abs(r)}%`
}

function deltaTone(v: number): DcTone {
  return v > 0.5 ? 'ok' : v < -0.5 ? 'bad' : 'mute'
}

function greetingFor(name: string, now: Date | null) {
  const first = name.split(' ')[0] ?? name
  if (!now) return `Welcome back, ${first}`
  const hour = now.getHours()
  const part = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  return `${part}, ${first}`
}

export function DcDashboard() {
  const router = useRouter()
  return (
    <DcScreenProvider screen="dashboard" onNavigate={(next) => router.push(`/dashboard/${next}`)}>
      <DcDashboardBody />
    </DcScreenProvider>
  )
}

function DcDashboardBody() {
  const router = useRouter()
  const [range, setRange] = useState<RangeId>('14D')
  const now = useClientNow()

  const { data: sessionUser } = useAdminSession()
  const stats = useDashboardStats('Today')
  const insights = useDashboardInsights('30 Days')
  const alerts = useInventoryAlerts()
  const orders = useOrders({ limit: 100 })
  const products = useProducts({ limit: 200 })
  const connection = useAdminConnection(25_000)

  // The only revenue timeline the API exposes. No synthetic daily split — if it
  // comes back empty the chart says so rather than drawing noise.
  const pl = useQuery({
    queryKey: ['profit-loss', 'monthly'],
    queryFn: () => fetchProfitLoss('monthly'),
    staleTime: 60_000,
  })

  const timeline: TimelinePoint[] = useMemo(() => {
    const raw = pl.data as { timeline?: TimelinePoint[] } | undefined
    return Array.isArray(raw?.timeline) ? raw.timeline : []
  }, [pl.data])

  const rangeDays = RANGES.find((r) => r.id === range)?.days ?? 14
  const chartPoints = useMemo(() => timeline.slice(-rangeDays), [timeline, rangeDays])
  const chartTotal = useMemo(
    () => chartPoints.reduce((sum, p) => sum + (p.revenue ?? 0), 0),
    [chartPoints],
  )

  const allOrders = useMemo(() => orders.data?.orders ?? [], [orders.data])

  const stageCounts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const o of allOrders) {
      const k = o.status.toUpperCase()
      c[k] = (c[k] ?? 0) + 1
    }
    return c
  }, [allOrders])

  // COD still on the road: cash the store is exposed to until a rider settles.
  const codExposure = useMemo(
    () =>
      allOrders
        .filter(
          (o) =>
            o.paymentMethod?.toUpperCase().includes('COD') &&
            ['PACKED', 'SHIPPED', 'PROCESSING'].includes(o.status.toUpperCase()),
        )
        .reduce((sum, o) => sum + Number(o.total || 0), 0),
    [allOrders],
  )
  const codParcels = useMemo(
    () =>
      allOrders.filter(
        (o) =>
          o.paymentMethod?.toUpperCase().includes('COD') &&
          ['PACKED', 'SHIPPED', 'PROCESSING'].includes(o.status.toUpperCase()),
      ).length,
    [allOrders],
  )

  const awaitingAction = (stageCounts['PENDING'] ?? 0) + (stageCounts['CONFIRMED'] ?? 0)

  const stockOf = (p: { variants?: Array<{ stock?: number; stockQuantity?: number }> }) =>
    (p.variants ?? []).reduce((sum, v) => sum + (v.stockQuantity ?? v.stock ?? 0), 0)

  const catalog = useMemo(() => products.data?.products ?? [], [products.data])
  const restock = useMemo(
    () =>
      catalog
        .filter((p) => stockOf(p) <= (p.lowStockThreshold ?? 5))
        .sort((a, b) => stockOf(a) - stockOf(b))
        .slice(0, 5),
    [catalog],
  )
  const publishedOut = useMemo(
    () => catalog.filter((p) => p.isPublished && stockOf(p) === 0),
    [catalog],
  )

  const s = stats.data
  const pageStatus = dcPageStatus([stats, orders, products, insights, alerts, pl], connection.api.pulse)
  const loading = [stats, orders, products, insights, alerts, pl].some((q) => q.isLoading)
  const error = stats.error

  const skeleton: DcBlock[] = [
    { t: 'hero', w: 'main' } as DcBlock,
    { t: 'list', w: 'side' } as DcBlock,
    { t: 'kpis' } as DcBlock,
    { t: 'chart', w: 'main' } as DcBlock,
    { t: 'list', w: 'side' } as DcBlock,
  ]

  const refetchAll = () => {
    void stats.refetch()
    void insights.refetch()
    void alerts.refetch()
    void orders.refetch()
    void products.refetch()
    void pl.refetch()
  }

  return (
    <>
      <DcPageHead
        crumbGroup="Overview"
        title="Dashboard"
        statusLabel={pageStatus.label}
        statusTone={pageStatus.tone}
        syncLabel={stats.isFetching ? 'syncing…' : greetingFor(sessionUser?.name ?? 'there', now)}
        syncing={stats.isFetching}
        onSync={refetchAll}
        actions={[
          {
            label: 'Daily close',
            icon: 'icon-calendar-check',
            onClick: () => router.push('/dashboard/finance/daily-closing'),
          },
          {
            label: 'New order',
            icon: 'icon-plus',
            variant: 'primary',
            onClick: () => router.push('/dashboard/orders/new'),
          },
        ]}
      />

      {error ? (
        <DcErrorState
          error={`GET /admin/dashboard/stats → ${error instanceof Error ? error.message : '500 Internal Server Error'}`}
          hint="The rest of the shell is live — only this module's data failed to load."
          onRetry={refetchAll}
        />
      ) : loading ? (
        <DcLoadingState blocks={skeleton} />
      ) : (
        <>
          <MobileTodayList
            greeting={greetingFor(sessionUser?.name ?? 'there', now)}
            revenue={s?.revenue.value ?? 0}
            revenueChange={s?.revenue.change ?? 0}
            orders={s?.orders.value ?? 0}
            awaitingAction={awaitingAction}
            codRisk={s?.alerts.codRiskOrders ?? 0}
            customers={s?.customers.value ?? 0}
            avgOrderValue={s?.avgOrderValue.value ?? 0}
            failedPayments={s?.alerts.failedPayments ?? 0}
            lowStock={alerts.data?.lowStock ?? 0}
            onGo={(href) => router.push(href)}
          />

          <div className="dc-desktop-route-panel">
          {/* ── row 1: today + copilot ─────────────────────────────── */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(352px, 100%), 1fr))',
              gap: 16,
              alignItems: 'stretch',
            }}
          >
            <TodayCard
              greeting={greetingFor(sessionUser?.name ?? 'there', now)}
              now={now}
              stats={s}
              awaitingAction={awaitingAction}
              customers={s?.customers.value ?? 0}
            />
            <CopilotCard
              publishedOut={publishedOut.length}
              lowStock={alerts.data?.lowStock ?? 0}
              awaitingAction={awaitingAction}
              failedPayments={s?.alerts.failedPayments ?? 0}
              codRisk={s?.alerts.codRiskOrders ?? 0}
              codExposure={codExposure}
              codParcels={codParcels}
              onGo={(href) => router.push(href)}
            />
          </div>

          {/* ── row 2: KPI strip ───────────────────────────────────── */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(206px, 1fr))',
              gap: 12,
            }}
          >
            <KpiCard
              label="Revenue today"
              icon="icon-banknote"
              value={formatTaka(s?.revenue.value ?? 0)}
              deltaText={delta(s?.revenue.change ?? 0)}
              deltaTone={deltaTone(s?.revenue.change ?? 0)}
              sub="vs yesterday"
              spark={chartPoints.map((p) => p.revenue)}
              footer={
                timeline.length > 0
                  ? `${formatTaka(chartTotal)} over the last ${chartPoints.length} days`
                  : 'No revenue timeline from /profit-loss/monthly yet'
              }
            />
            <KpiCard
              label="Orders today"
              icon="icon-shopping-bag"
              value={String(s?.orders.value ?? 0)}
              deltaText={delta(s?.orders.change ?? 0)}
              deltaTone={deltaTone(s?.orders.change ?? 0)}
              sub={`${awaitingAction} awaiting action`}
              footer={`${allOrders.length} orders in the current window`}
            />
            <KpiCard
              label="Avg order value"
              icon="icon-receipt"
              value={formatTaka(s?.avgOrderValue.value ?? 0)}
              deltaText={delta(s?.avgOrderValue.change ?? 0)}
              deltaTone={deltaTone(s?.avgOrderValue.change ?? 0)}
              sub="per checkout"
              footer={`${s?.customers.value ?? 0} customers in this window`}
            />
            <KpiCard
              label="COD exposure"
              icon="icon-truck"
              value={formatTaka(codExposure)}
              deltaText={`${codParcels} parcels`}
              deltaTone={codParcels > 0 ? 'warn' : 'mute'}
              sub="in transit"
              footer={
                codParcels > 0
                  ? 'Cash the store carries until riders settle'
                  : 'No COD parcels on the road right now'
              }
            />
          </div>

          {/* ── row 3: revenue + pipeline ──────────────────────────── */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))',
              gap: 16,
              alignItems: 'start',
            }}
          >
            <RevenueChart
              points={chartPoints}
              total={chartTotal}
              range={range}
              onRange={setRange}
              loading={pl.isLoading}
            />
            <PipelineCard
              counts={stageCounts}
              total={allOrders.length}
              onOpen={() => router.push('/dashboard/orders')}
              onStage={(id) => router.push(`/dashboard/orders?status=${id}`)}
            />
          </div>

          {/* ── row 4: latest orders + alerts ──────────────────────── */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))',
              gap: 16,
              alignItems: 'start',
            }}
          >
            <div style={{ ...card, minWidth: 0, overflow: 'auto' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '13px 16px',
                  borderBottom: '1px solid var(--line)',
                }}
              >
                <span style={{ flex: 1, font: `600 13.5px/1 ${FONT}`, color: 'var(--ink)' }}>
                  Latest orders
                </span>
                <button
                  type="button"
                  onClick={() => router.push('/dashboard/orders')}
                  style={{
                    border: 0,
                    background: 'transparent',
                    cursor: 'pointer',
                    font: `600 12px/1 ${FONT}`,
                    color: 'var(--violet)',
                  }}
                >
                  View all
                </button>
              </div>
              {allOrders.length === 0 ? (
                <EmptyNote text="No orders yet. The queue fills the moment a customer checks out." />
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', minWidth: 720, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={th}>Order</th>
                      <th style={th}>Customer</th>
                      <th style={th}>Status</th>
                      <th style={{ ...th, textAlign: 'right' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allOrders.slice(0, 5).map((o) => {
                      const tone = statusToneStyle(titleCase(o.status))
                      return (
                        <tr
                          key={o.id}
                          onClick={() => router.push(`/dashboard/orders/${o.id}`)}
                          className="dc-hover-surface"
                          style={{ borderBottom: '1px solid var(--line)', cursor: 'pointer' }}
                        >
                          <td style={{ padding: '11px 16px', font: `600 12.5px/1 ${MONO}`, color: 'var(--ink)' }}>
                            {o.invoiceNumber}
                          </td>
                          <td style={{ padding: '11px 16px', font: `500 13px/1 ${FONT}`, color: 'var(--ink-2)' }}>
                            {o.shippingName}
                          </td>
                          <td style={{ padding: '11px 16px' }}>
                            <Chip tone={tone} label={titleCase(o.status)} />
                          </td>
                          <td
                            style={{
                              padding: '11px 16px',
                              textAlign: 'right',
                              font: `600 13px/1 ${MONO}`,
                              color: 'var(--ink)',
                            }}
                          >
                            {formatTaka(Number(o.total))}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  </table>
                </div>
              )}
            </div>

            <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <RestockCard
                items={restock.map((p) => ({
                  id: p.id,
                  name: p.name,
                  sku: p.sku ?? '—',
                  left: stockOf(p),
                }))}
                onOpen={() => router.push('/dashboard/inventory')}
                loading={products.isLoading}
              />
              <HealthCard
                api={connection.api.pulse}
                latency={connection.api.latencyMs}
                database={connection.database.pulse}
                storefront={connection.storefront.pulse}
                storefrontLatency={connection.storefront.latencyMs}
              />
            </div>
          </div>

          {insights.data?.recentActivities?.length ? (
            <div style={{ ...card, padding: '6px 16px 10px' }}>
              <div style={{ padding: '11px 0 9px', font: `600 13.5px/1 ${FONT}`, color: 'var(--ink)' }}>
                Recent activity
              </div>
              {insights.data.recentActivities.slice(0, 8).map((a, i) => (
                <div
                  key={`${a.id}-${i}`}
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
                      color:
                        a.type === 'payment'
                          ? 'var(--ok)'
                          : a.type === 'shipping'
                            ? 'var(--info)'
                            : 'var(--violet)',
                    }}
                  >
                    <DcIcon
                      name={
                        a.type === 'order'
                          ? 'icon-shopping-bag'
                          : a.type === 'customer'
                            ? 'icon-user-plus'
                            : a.type === 'payment'
                              ? 'icon-credit-card'
                              : 'icon-truck'
                      }
                      size={12}
                    />
                  </span>
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      font: `500 12.5px/1.45 ${FONT}`,
                      color: 'var(--ink-2)',
                      textWrap: 'pretty',
                    }}
                  >
                    {a.message}
                  </span>
                  <span
                    style={{
                      flex: 'none',
                      font: `400 11px/1.5 ${MONO}`,
                      color: 'var(--ink-3)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {new Date(a.at).toLocaleTimeString('en-GB', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
          </div>
        </>
      )}
    </>
  )
}

function MobileTodayList({
  greeting,
  revenue,
  revenueChange,
  orders,
  awaitingAction,
  codRisk,
  customers,
  avgOrderValue,
  failedPayments,
  lowStock,
  onGo,
}: {
  greeting: string
  revenue: number
  revenueChange: number
  orders: number
  awaitingAction: number
  codRisk: number
  customers: number
  avgOrderValue: number
  failedPayments: number
  lowStock: number
  onGo: (href: string) => void
}) {
  const changeTone = toneStyle(deltaTone(revenueChange))
  const tiles = [
    {
      title: 'Orders',
      value: String(orders),
      sub: `${awaitingAction} need action`,
      href: '/dashboard/orders',
      warn: awaitingAction > 0,
    },
    {
      title: 'AOV',
      value: formatTaka(avgOrderValue),
      sub: 'per checkout',
      href: '/dashboard/analytics',
      warn: false,
    },
    {
      title: 'Customers',
      value: String(customers),
      sub: 'this window',
      href: '/dashboard/customers',
      warn: false,
    },
    {
      title: 'COD risk',
      value: String(codRisk),
      sub: 'flagged today',
      href: '/dashboard/orders?status=PENDING',
      warn: codRisk > 0,
    },
  ]

  const alerts = [
    failedPayments > 0
      ? {
          title: `${failedPayments} failed payment${failedPayments === 1 ? '' : 's'}`,
          sub: 'Gateway declined or timed out',
          href: '/dashboard/transactions',
          tone: 'bad' as const,
        }
      : null,
    lowStock > 0
      ? {
          title: `${lowStock} low-stock SKU${lowStock === 1 ? '' : 's'}`,
          sub: 'Restock before the next drop',
          href: '/dashboard/inventory?stock=low',
          tone: 'warn' as const,
        }
      : null,
    awaitingAction > 0
      ? {
          title: `${awaitingAction} order${awaitingAction === 1 ? '' : 's'} waiting`,
          sub: 'Pending or confirmed — pack queue next',
          href: '/dashboard/orders?status=PENDING',
          tone: 'vio' as const,
        }
      : null,
  ].filter(Boolean) as Array<{ title: string; sub: string; href: string; tone: DcTone }>

  return (
    <div className="dc-mobile-route-panel" aria-label="Today overview">
      <button type="button" className="dc-mobile-hero" onClick={() => onGo('/dashboard/analytics')}>
        <span className="dc-mobile-hero__eyebrow">{greeting}</span>
        <span className="dc-mobile-hero__value">{formatTaka(revenue)}</span>
        <span className="dc-mobile-hero__meta">
          <span style={{ color: changeTone.fg }}>{delta(revenueChange)}</span>
          <span>vs yesterday · Revenue today</span>
        </span>
      </button>

      <div className="dc-mobile-kpi-grid">
        {tiles.map((tile) => (
          <button
            key={tile.title}
            type="button"
            className="dc-mobile-kpi"
            data-warn={tile.warn ? 'true' : 'false'}
            onClick={() => onGo(tile.href)}
          >
            <span className="dc-mobile-kpi__label">{tile.title}</span>
            <span className="dc-mobile-kpi__value">{tile.value}</span>
            <span className="dc-mobile-kpi__sub">{tile.sub}</span>
          </button>
        ))}
      </div>

      <div className="dc-mobile-quick">
        <button type="button" className="dc-mobile-quick__btn dc-mobile-quick__btn--primary" onClick={() => onGo('/dashboard/orders/new')}>
          <DcIcon name="icon-plus" size={15} />
          New order
        </button>
        <button type="button" className="dc-mobile-quick__btn" onClick={() => onGo('/dashboard/packing-station')}>
          <DcIcon name="icon-scan-line" size={15} />
          Pack
        </button>
        <button type="button" className="dc-mobile-quick__btn" onClick={() => onGo('/dashboard/products/new')}>
          <DcIcon name="icon-package" size={15} />
          Product
        </button>
      </div>

      {alerts.length > 0 ? (
        <div className="dc-mobile-list">
          {alerts.map((a) => {
            const t = toneStyle(a.tone)
            return (
              <button key={a.title} type="button" className="dc-mobile-list-card" onClick={() => onGo(a.href)}>
                <span className="dc-mobile-list-card__icon" style={{ background: t.bg, color: t.fg }}>
                  <DcIcon name="icon-triangle-alert" size={15} />
                </span>
                <span className="dc-mobile-list-card__copy">
                  <span className="dc-mobile-list-card__title">{a.title}</span>
                  <span className="dc-mobile-list-card__sub">{a.sub}</span>
                </span>
                <DcIcon name="icon-chevron-right" size={16} color="var(--ink-3)" />
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

/* ── today card ──────────────────────────────────────────────────── */

function TodayCard({
  greeting,
  now,
  stats,
  awaitingAction,
  customers,
}: {
  greeting: string
  now: Date | null
  stats:
    | {
        revenue: { value: number; change: number }
        orders: { value: number; change: number }
        avgOrderValue: { value: number; change: number }
      }
    | undefined
  awaitingAction: number
  customers: number
}) {
  const change = stats?.revenue.change ?? 0
  const tone = toneStyle(deltaTone(change))

  return (
    <div
      style={{
        ...card,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        padding: '18px 19px 17px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={{ font: `600 12.5px/1 ${FONT}`, color: 'var(--ink-3)' }}>{greeting}</span>
          <span style={{ font: `400 12px/1.5 ${FONT}`, color: 'var(--ink-3)' }}>
            {now
              ? now.toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long' })
              : 'Today'}
          </span>
        </div>
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '5px 9px',
            borderRadius: 7,
            border: `1px solid ${tone.bd}`,
            background: tone.bg,
            font: `600 11px/1 ${FONT}`,
            color: tone.fg,
          }}
        >
          <span style={{ width: 5, height: 5, borderRadius: 99, background: 'currentColor' }} />
          {change > 0.5 ? 'UP ON YESTERDAY' : change < -0.5 ? 'DOWN ON YESTERDAY' : 'FLAT'}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
        <span
          style={{
            font: `700 46px/.9 ${FONT}`,
            letterSpacing: '-.038em',
            color: 'var(--ink)',
          }}
        >
          {formatTaka(stats?.revenue.value ?? 0)}
        </span>
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 3,
            padding: '3px 7px',
            borderRadius: 6,
            marginBottom: 5,
            font: `600 12px/1 ${FONT}`,
            background: tone.bg,
            color: tone.fg,
          }}
        >
          <DcIcon name={change < 0 ? 'icon-trending-down' : 'icon-trending-up'} size={12} />
          {delta(change)}
        </span>
      </div>

      {/* The design shows a daily-target bar. No target endpoint exists, so this
          row carries the figures the API does return instead of an invented goal. */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 1,
          background: 'var(--line)',
          border: '1px solid var(--line)',
          borderRadius: 11,
          overflow: 'hidden',
          marginTop: 'auto',
        }}
      >
        <SubStat
          label="Orders"
          value={String(stats?.orders.value ?? 0)}
          sub={`${awaitingAction} awaiting action`}
          subColor={awaitingAction > 0 ? 'var(--warn)' : 'var(--ink-3)'}
        />
        <SubStat
          label="Avg order value"
          value={formatTaka(stats?.avgOrderValue.value ?? 0)}
          sub={delta(stats?.avgOrderValue.change ?? 0)}
          subColor={
            (stats?.avgOrderValue.change ?? 0) < -0.5 ? 'var(--bad)' : 'var(--ink-3)'
          }
        />
        <SubStat label="Customers" value={String(customers)} sub="in this window" subColor="var(--ink-3)" />
      </div>
    </div>
  )
}

function SubStat({
  label,
  value,
  sub,
  subColor,
}: {
  label: string
  value: string
  sub: string
  subColor: string
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 5,
        padding: '11px 12px',
        background: 'var(--surface-2)',
      }}
    >
      <span style={{ ...capsLabel, font: `600 10.5px/1 ${FONT}`, letterSpacing: '.08em' }}>
        {label}
      </span>
      <span
        style={{ font: `700 19px/1 ${FONT}`, letterSpacing: '-.02em', color: 'var(--ink)' }}
      >
        {value}
      </span>
      <span style={{ font: `500 11px/1 ${FONT}`, color: subColor }}>{sub}</span>
    </div>
  )
}

/* ── copilot ─────────────────────────────────────────────────────── */

interface Signal {
  icon: string
  tone: DcTone
  text: string
  source: string
  cta: string
  href: string
  weight: number
}

/**
 * Signals are derived from endpoints this dashboard already reads — nothing is
 * generated. When every counter is clean the panel says so instead of inventing
 * something to look busy.
 */
function CopilotCard({
  publishedOut,
  lowStock,
  awaitingAction,
  failedPayments,
  codRisk,
  codExposure,
  codParcels,
  onGo,
}: {
  publishedOut: number
  lowStock: number
  awaitingAction: number
  failedPayments: number
  codRisk: number
  codExposure: number
  codParcels: number
  onGo: (href: string) => void
}) {
  const signals: Signal[] = []

  if (publishedOut > 0) {
    signals.push({
      icon: 'icon-circle-x',
      tone: 'bad',
      text: `${publishedOut} published product${publishedOut === 1 ? '' : 's'} cannot be bought — stock is zero`,
      source: 'products · variants stock',
      cta: 'Inventory',
      href: '/dashboard/inventory',
      weight: 100,
    })
  }
  if (failedPayments > 0) {
    signals.push({
      icon: 'icon-credit-card',
      tone: 'bad',
      text: `${failedPayments} payment${failedPayments === 1 ? '' : 's'} failed at the gateway`,
      source: 'dashboard.alerts · failedPayments',
      cta: 'Orders',
      href: '/dashboard/orders',
      weight: 90,
    })
  }
  if (awaitingAction > 0) {
    signals.push({
      icon: 'icon-shopping-bag',
      tone: 'warn',
      text: `${awaitingAction} order${awaitingAction === 1 ? '' : 's'} waiting to be confirmed or packed`,
      source: 'orders · status pending + confirmed',
      cta: 'Packing',
      href: '/dashboard/packing-station',
      weight: 80,
    })
  }
  if (codParcels > 0) {
    signals.push({
      icon: 'icon-truck',
      tone: 'warn',
      text: `${formatTaka(codExposure)} of COD is on the road across ${codParcels} parcel${codParcels === 1 ? '' : 's'}`,
      source: 'orders · COD in packed/shipped',
      cta: 'Courier',
      href: '/dashboard/courier-hub',
      weight: 70,
    })
  }
  if (codRisk > 0) {
    signals.push({
      icon: 'icon-shield-alert',
      tone: 'warn',
      text: `${codRisk} order${codRisk === 1 ? '' : 's'} flagged as COD risk`,
      source: 'dashboard.alerts · codRiskOrders',
      cta: 'Orders',
      href: '/dashboard/orders',
      weight: 60,
    })
  }
  if (lowStock > 0) {
    signals.push({
      icon: 'icon-package',
      tone: 'warn',
      text: `${lowStock} SKU${lowStock === 1 ? '' : 's'} at or below the reorder point`,
      source: 'dashboard · inventory-alerts',
      cta: 'Restock',
      href: '/dashboard/inventory',
      weight: 50,
    })
  }

  signals.sort((a, b) => b.weight - a.weight)
  const top = signals[0]

  return (
    <div
      style={{
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid var(--violet-bd)',
        borderRadius: 14,
        background: 'var(--surface)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          padding: '12px 15px',
          borderBottom: '1px solid var(--line)',
          background: 'var(--violet-soft)',
        }}
      >
        <DcIcon name="icon-sparkles" size={14} color="var(--violet)" />
        <span style={{ flex: 1, font: `600 13px/1 ${FONT}`, color: 'var(--ink)' }}>
          Business Copilot
        </span>
        <span style={{ font: `500 10.5px/1 ${MONO}`, color: 'var(--ink-3)' }}>
          {signals.length} signal{signals.length === 1 ? '' : 's'}
        </span>
      </div>

      <div style={{ flex: 1, padding: '5px 7px', display: 'flex', flexDirection: 'column' }}>
        {signals.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              padding: '34px 14px',
              textAlign: 'center',
            }}
          >
            <DcIcon name="icon-circle-check" size={20} color="var(--ok)" />
            <span style={{ font: `600 13px/1.3 ${FONT}`, color: 'var(--ink)' }}>
              Nothing needs a decision
            </span>
            <span
              style={{ font: `400 11.5px/1.5 ${FONT}`, color: 'var(--ink-3)', maxWidth: 280 }}
            >
              No blocked orders, no failed payments, nothing out of stock while published.
            </span>
          </div>
        ) : (
          signals.map((sig) => {
            const t = toneStyle(sig.tone)
            return (
              <button
                key={sig.text}
                type="button"
                onClick={() => onGo(sig.href)}
                className="dc-hover-surface"
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  padding: '9px 8px',
                  border: 0,
                  borderRadius: 9,
                  background: 'transparent',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span
                  style={{
                    width: 22,
                    height: 22,
                    flex: 'none',
                    marginTop: 1,
                    borderRadius: 6,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: t.bg,
                    color: t.fg,
                  }}
                >
                  <DcIcon name={sig.icon} size={12} />
                </span>
                <span
                  style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}
                >
                  <span
                    style={{
                      font: `500 12.5px/1.45 ${FONT}`,
                      color: 'var(--ink-2)',
                      textWrap: 'pretty',
                    }}
                  >
                    {sig.text}
                  </span>
                  <span style={{ font: `500 10.5px/1 ${MONO}`, color: 'var(--ink-3)' }}>
                    {sig.source}
                  </span>
                </span>
                <span
                  style={{
                    font: `600 11.5px/1 ${FONT}`,
                    color: 'var(--violet)',
                    flex: 'none',
                    marginTop: 2,
                  }}
                >
                  {sig.cta}
                </span>
              </button>
            )
          })
        )}
      </div>

      {top ? (
        <div
          style={{
            margin: '0 11px 11px',
            padding: '12px 13px',
            border: '1px solid var(--line)',
            borderRadius: 11,
            background: 'var(--surface-2)',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ ...capsLabel, font: `600 10.5px/1 ${FONT}` }}>Most urgent</span>
            <span style={{ font: `600 13.5px/1.35 ${FONT}`, color: 'var(--ink)' }}>{top.text}</span>
          </span>
          <span
            style={{ font: `400 11.5px/1.5 ${FONT}`, color: 'var(--ink-3)', textWrap: 'pretty' }}
          >
            Ranked by how much it blocks — read from {top.source}.
          </span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => onGo(top.href)}
              style={{
                height: 31,
                padding: '0 13px',
                borderRadius: 8,
                border: 0,
                background: 'var(--violet-solid)',
                color: 'var(--on-violet)',
                cursor: 'pointer',
                font: `600 12px/1 ${FONT}`,
              }}
            >
              Open {top.cta}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

/* ── KPI card ────────────────────────────────────────────────────── */

function KpiCard({
  label,
  icon,
  value,
  deltaText,
  deltaTone: tone,
  sub,
  spark,
  footer,
}: {
  label: string
  icon: string
  value: string
  deltaText: string
  deltaTone: DcTone
  sub: string
  spark?: number[]
  footer: string
}) {
  const t = toneStyle(tone)
  const peak = spark && spark.length > 0 ? Math.max(...spark, 1) : 0

  return (
    <div
      style={{
        ...card,
        padding: '14px 15px 13px',
        display: 'flex',
        flexDirection: 'column',
        gap: 9,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ ...capsLabel, flex: 1 }}>{label}</span>
        <DcIcon name={icon} size={14} color="var(--ink-3)" />
      </div>
      <div style={{ font: `700 26px/1 ${FONT}`, letterSpacing: '-.025em', color: 'var(--ink)' }}>
        {value}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 3,
            padding: '2px 6px',
            borderRadius: 5,
            font: `600 11px/1 ${FONT}`,
            background: t.bg,
            color: t.fg,
          }}
        >
          {deltaText}
        </span>
        <span style={{ font: `400 11.5px/1 ${FONT}`, color: 'var(--ink-3)' }}>{sub}</span>
      </div>

      {spark && spark.length > 1 ? (
        <div
          style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 36, marginTop: 2 }}
        >
          {spark.map((v, i) => (
            <span
              key={i}
              title={formatTaka(v)}
              style={{
                flex: 1,
                borderRadius: 2,
                background: i === spark.length - 1 ? 'var(--violet-solid)' : 'var(--violet-soft)',
                height: `${Math.max(6, Math.round((v / peak) * 100))}%`,
              }}
            />
          ))}
        </div>
      ) : null}

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          paddingTop: 8,
          borderTop: '1px solid var(--line)',
        }}
      >
        <DcIcon name="icon-git-commit-horizontal" size={12} color="var(--ink-3)" />
        <span
          style={{
            flex: 1,
            font: `400 11px/1.35 ${FONT}`,
            color: 'var(--ink-3)',
            textWrap: 'pretty',
          }}
        >
          {footer}
        </span>
      </div>
    </div>
  )
}

/* ── revenue chart ───────────────────────────────────────────────── */

function RevenueChart({
  points,
  total,
  range,
  onRange,
  loading,
}: {
  points: TimelinePoint[]
  total: number
  range: RangeId
  onRange: (r: RangeId) => void
  loading: boolean
}) {
  const peak = points.length > 0 ? Math.max(...points.map((p) => p.revenue), 1) : 1

  return (
    <div style={{ ...card, minWidth: 0, overflow: 'hidden' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '13px 16px',
          borderBottom: '1px solid var(--line)',
          flexWrap: 'wrap',
        }}
      >
        <span style={{ flex: 1, font: `600 13.5px/1 ${FONT}`, color: 'var(--ink)' }}>
          Revenue · last {range.replace('D', ' days')}
        </span>
        <span style={{ font: `600 12px/1 ${MONO}`, color: 'var(--ink-2)' }}>
          {formatTaka(total)}
        </span>
        <div
          style={{
            display: 'flex',
            gap: 3,
            padding: 3,
            borderRadius: 8,
            background: 'var(--surface-2)',
            border: '1px solid var(--line)',
          }}
        >
          {RANGES.map((r) => {
            const on = r.id === range
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => onRange(r.id)}
                style={{
                  height: 24,
                  padding: '0 9px',
                  borderRadius: 6,
                  border: 0,
                  cursor: 'pointer',
                  font: `600 11.5px/1 ${FONT}`,
                  background: on ? 'var(--violet-solid)' : 'transparent',
                  color: on ? 'var(--on-violet)' : 'var(--ink-3)',
                }}
              >
                {r.id}
              </button>
            )
          })}
        </div>
      </div>

      {points.length === 0 ? (
        <EmptyNote
          text={
            loading
              ? 'Loading the revenue timeline…'
              : 'GET /profit-loss/monthly returned no timeline. The chart appears once the API sends one — nothing is drawn from a guess.'
          }
        />
      ) : (
        <div style={{ padding: '18px 16px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 7, height: 168 }}>
            {points.map((p, i) => (
              <div
                key={`${p.label}-${i}`}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'flex-end',
                  gap: 6,
                  height: '100%',
                }}
              >
                <div
                  title={`${p.label} · ${formatTaka(p.revenue)}`}
                  style={{
                    borderRadius: '5px 5px 2px 2px',
                    background:
                      i === points.length - 1 ? 'var(--violet-solid)' : 'var(--violet-soft)',
                    height: `${Math.max(2, Math.round((p.revenue / peak) * 100))}%`,
                  }}
                />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 7, marginTop: 8 }}>
            {points.map((p, i) => (
              <div
                key={`l-${p.label}-${i}`}
                style={{
                  flex: 1,
                  textAlign: 'center',
                  font: `500 10px/1 ${FONT}`,
                  color: 'var(--ink-3)',
                  overflow: 'hidden',
                }}
              >
                {p.label}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── pipeline ────────────────────────────────────────────────────── */

function PipelineCard({
  counts,
  total,
  onOpen,
  onStage,
}: {
  counts: Record<string, number>
  total: number
  onOpen: () => void
  onStage: (id: string) => void
}) {
  const peak = Math.max(...PIPELINE.map((p) => counts[p.id] ?? 0), 1)

  return (
    <div style={{ ...card, minWidth: 0, overflow: 'hidden' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '13px 16px',
          borderBottom: '1px solid var(--line)',
        }}
      >
        <span style={{ flex: 1, font: `600 13.5px/1 ${FONT}`, color: 'var(--ink)' }}>
          Fulfilment pipeline
        </span>
        <button
          type="button"
          onClick={onOpen}
          style={{
            border: 0,
            background: 'transparent',
            cursor: 'pointer',
            font: `600 12px/1 ${FONT}`,
            color: 'var(--violet)',
          }}
        >
          Open orders
        </button>
      </div>
      {total === 0 ? (
        <EmptyNote text="Nothing in the pipeline. Stages fill as orders come in." />
      ) : (
        <div style={{ padding: '8px 8px 10px', display: 'flex', flexDirection: 'column' }}>
          {PIPELINE.map((p) => {
            const n = counts[p.id] ?? 0
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onStage(p.id)}
                className="dc-hover-surface"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 11,
                  padding: '9px 8px',
                  border: 0,
                  borderRadius: 9,
                  background: 'transparent',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span
                  style={{ width: 8, height: 8, borderRadius: 99, flex: 'none', background: p.dot }}
                />
                <span style={{ flex: 1, font: `500 13px/1 ${FONT}`, color: 'var(--ink-2)' }}>
                  {p.label}
                </span>
                <span
                  style={{
                    width: 96,
                    height: 5,
                    borderRadius: 99,
                    background: 'var(--surface-3)',
                    overflow: 'hidden',
                    flex: 'none',
                  }}
                >
                  <span
                    style={{
                      display: 'block',
                      height: '100%',
                      borderRadius: 99,
                      background: p.dot,
                      width: `${Math.round((n / peak) * 100)}%`,
                    }}
                  />
                </span>
                <span
                  style={{
                    width: 26,
                    textAlign: 'right',
                    font: `600 13px/1 ${MONO}`,
                    color: 'var(--ink)',
                  }}
                >
                  {n}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ── restock + health ────────────────────────────────────────────── */

function RestockCard({
  items,
  onOpen,
  loading,
}: {
  items: Array<{ id: string; name: string; sku: string; left: number }>
  onOpen: () => void
  loading: boolean
}) {
  const empty = items.length === 0
  return (
    <div
      style={{
        border: `1px solid ${empty ? 'var(--line)' : 'var(--warn-bd)'}`,
        borderRadius: 12,
        background: 'var(--surface)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '12px 15px',
          borderBottom: '1px solid var(--line)',
          background: empty ? 'transparent' : 'var(--warn-soft)',
        }}
      >
        <DcIcon
          name={empty ? 'icon-circle-check' : 'icon-triangle-alert'}
          size={14}
          color={empty ? 'var(--ok)' : 'var(--warn)'}
        />
        <span style={{ flex: 1, font: `600 13px/1 ${FONT}`, color: 'var(--ink)' }}>
          Restock alert
        </span>
        <button
          type="button"
          onClick={onOpen}
          style={{
            border: 0,
            background: 'transparent',
            cursor: 'pointer',
            font: `600 11.5px/1 ${FONT}`,
            color: empty ? 'var(--ink-3)' : 'var(--warn)',
          }}
        >
          {empty ? 'All good' : `${items.length} SKUs`}
        </button>
      </div>
      {empty ? (
        <EmptyNote
          text={loading ? 'Checking stock levels…' : 'Nothing is at or below its reorder point.'}
        />
      ) : (
        <div style={{ padding: '6px 8px 8px', display: 'flex', flexDirection: 'column' }}>
          {items.map((r) => (
            <div
              key={r.id}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 8 }}
            >
              <span
                style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}
              >
                <span
                  style={{
                    font: `500 12.5px/1 ${FONT}`,
                    color: 'var(--ink)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {r.name}
                </span>
                <span style={{ font: `500 11px/1 ${MONO}`, color: 'var(--ink-3)' }}>{r.sku}</span>
              </span>
              <span
                style={{
                  font: `700 12.5px/1 ${MONO}`,
                  color: r.left === 0 ? 'var(--bad)' : 'var(--warn)',
                }}
              >
                {r.left === 0 ? 'None' : r.left}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function HealthCard({
  api,
  latency,
  database,
  storefront,
  storefrontLatency,
}: {
  api: string
  latency: number | null
  database: string
  storefront: string
  storefrontLatency: number | null
}) {
  const dot = (pulse: string) =>
    pulse === 'online' ? 'var(--ok)' : pulse === 'degraded' ? 'var(--warn)' : 'var(--bad)'

  const rows = [
    { label: 'API', pulse: api, value: latency != null ? `${latency}ms` : api },
    { label: 'Database', pulse: database, value: database },
    {
      label: 'Storefront',
      pulse: storefront,
      value: storefrontLatency != null ? `${storefrontLatency}ms` : storefront,
    },
  ]

  return (
    <div style={{ ...card, overflow: 'hidden' }}>
      <div
        style={{
          padding: '12px 15px',
          borderBottom: '1px solid var(--line)',
          font: `600 13px/1 ${FONT}`,
          color: 'var(--ink)',
        }}
      >
        System health
      </div>
      <div style={{ padding: '6px 8px 9px', display: 'flex', flexDirection: 'column' }}>
        {rows.map((h) => (
          <div key={h.label} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: 8 }}>
            <span
              style={{ width: 7, height: 7, borderRadius: 99, flex: 'none', background: dot(h.pulse) }}
            />
            <span style={{ flex: 1, font: `500 12.5px/1 ${FONT}`, color: 'var(--ink-2)' }}>
              {h.label}
            </span>
            <span style={{ font: `600 11.5px/1 ${MONO}`, color: dot(h.pulse) }}>{h.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── small shared ────────────────────────────────────────────────── */

function Chip({ tone, label }: { tone: { bg: string; fg: string; bd: string }; label: string }) {
  return (
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
      <span style={{ width: 5, height: 5, borderRadius: 99, background: 'currentColor' }} />
      {label}
    </span>
  )
}

function EmptyNote({ text }: { text: string }) {
  return (
    <div
      style={{
        padding: '38px 20px',
        textAlign: 'center',
        font: `400 12.5px/1.55 ${FONT}`,
        color: 'var(--ink-3)',
        textWrap: 'pretty',
      }}
    >
      {text}
    </div>
  )
}
