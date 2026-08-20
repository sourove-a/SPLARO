'use client'


import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useMemo, useState, type ReactNode } from 'react'

import { DcCountUp } from '@/components/dc/DcCountUp'
import {
  ConversionFunnelChart,
  OrdersBarChart,
  PeakHoursChart,
  TrafficSourceChart,
} from '@/components/dashboard/DcDashboardCharts'
import { DcIcon } from '@/components/dc/DcIcon'
import { DcPageHead } from '@/components/dc/DcPageHead'
import { dcPageStatus } from '@/components/dc/page-status'
import { DcScreenProvider } from '@/components/dc/DcScreenContext'
import { DcErrorState, DcLoadingState } from '@/components/dc/blocks/DcStates'
import type { DcBlock } from '@/components/dc/blocks/types'
import { FONT, MONO, formatTaka, statusToneStyle, toneStyle, type DcTone } from '@/components/dc/tokens'

import {
  useAdminSession,
  useConversionFunnel,
  useDailyGoal,
  useDashboardInsights,
  useDashboardStats,
  useInventoryAlerts,
  useOrders,
  useTrafficSources,
  useProducts,
  useRevenueSeries,
  useSaveDailyGoal,
} from '@/lib/api/hooks'
import { useClientNow } from '@/components/dc/useClientNow'
import { useAdminConnection } from '@/lib/hooks/use-admin-connection'
import { fetchFinanceOverview } from '@/lib/api/finance'

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

/** The API window to pull; 14D is served by slicing the 30d series. */
function seriesPeriodFor(range: RangeId): '7d' | '30d' {
  return range === '7D' ? '7d' : '30d'
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
  const funnel = useConversionFunnel('30d')
  const goal = useDailyGoal()
  const saveGoal = useSaveDailyGoal()
  const financePulse = useQuery({
    queryKey: ['finance-overview', 'today-pulse'],
    queryFn: () => fetchFinanceOverview({ preset: 'today' }),
    staleTime: 60_000,
    retry: 1,
  })

  // Revenue comes off the orders table, zero-filled per day by the API. The
  // profit-loss timeline was the old source, but it is built from
  // ProfitCalculation rows that only exist once costing has run — on most
  // stores that left this chart permanently empty.
  const revenue = useRevenueSeries(seriesPeriodFor(range))

  const timeline: TimelinePoint[] = useMemo(
    () =>
      (revenue.data?.data ?? []).map((row) => ({
        label: new Date(`${row.date}T00:00:00`).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
        }),
        revenue: Math.round(row.revenue),
      })),
    [revenue.data],
  )

  // The revenue series already carries a per-day order count, so the orders
  // chart costs no extra request.
  const orderTimeline = useMemo(
    () =>
      (revenue.data?.data ?? []).map((row) => ({
        label: new Date(`${row.date}T00:00:00`).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
        }),
        orders: Math.round(row.orders ?? 0),
      })),
    [revenue.data],
  )

  const traffic = useTrafficSources(range === '7D' ? '7d' : '30d')

  const rangeDays = RANGES.find((r) => r.id === range)?.days ?? 14
  const chartPoints = useMemo(() => timeline.slice(-rangeDays), [timeline, rangeDays])
  const chartTotal = useMemo(
    () => chartPoints.reduce((sum, p) => sum + (p.revenue ?? 0), 0),
    [chartPoints],
  )

  const allOrders = useMemo(() => orders.data?.orders ?? [], [orders.data])
  const orderCreatedAt = useMemo(() => allOrders.map((o) => o.createdAt), [allOrders])
  const orderBars = useMemo(() => orderTimeline.slice(-rangeDays), [orderTimeline, rangeDays])

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

  // Orders per cart. Carts are the only top-of-funnel figure recorded — there
  // is no page-view tracking — so this is the honest conversion denominator.
  const { conversion, carts } = useMemo(() => {
    const steps = funnel.data?.steps ?? []
    const cartCount = steps.find((s) => s.label === 'Carts created')?.count ?? null
    const placed = steps.find((s) => s.label === 'Orders placed')?.count ?? 0
    return {
      carts: cartCount,
      conversion: cartCount && cartCount > 0 ? (placed / cartCount) * 100 : null,
    }
  }, [funnel.data])

  const bestSellers: BestSellerRow[] = useMemo(
    () =>
      (insights.data?.topProducts ?? []).slice(0, 6).map((p) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        sold: p.sold,
        revenue: p.revenue,
        trend: p.trend,
      })),
    [insights.data],
  )

  const s = stats.data
  const pageStatus = dcPageStatus([stats, orders, products, insights, alerts, revenue], connection.api.pulse)
  const loading = [stats, orders, products, insights, alerts, revenue].some((q) => q.isLoading)
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
    void revenue.refetch()
    void funnel.refetch()
    void goal.refetch()
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
              conversion={conversion}
              carts={carts}
              goal={goal.data}
              onSetGoal={(value) => saveGoal.mutate(value)}
              savingGoal={saveGoal.isPending}
            />
            <CopilotCard
              publishedOut={publishedOut.length}
              lowStock={alerts.data?.lowStock ?? 0}
              awaitingAction={awaitingAction}
              failedPayments={s?.alerts.failedPayments ?? 0}
              codRisk={s?.alerts.codRiskOrders ?? 0}
              codExposure={codExposure}
              codParcels={codParcels}
              readAt={stats.dataUpdatedAt || null}
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
              value={<DcCountUp value={s?.revenue.value ?? 0} format={formatTaka} />}
              deltaText={delta(s?.revenue.change ?? 0)}
              deltaTone={deltaTone(s?.revenue.change ?? 0)}
              sub="vs yesterday"
              spark={chartPoints.map((p) => p.revenue)}
              footer={
                timeline.length > 0
                  ? `${formatTaka(chartTotal)} over the last ${chartPoints.length} days`
                  : 'No orders in this window yet'
              }
            />
            <KpiCard
              label="Orders today"
              icon="icon-shopping-bag"
              value={<DcCountUp value={s?.orders.value ?? 0} />}
              deltaText={delta(s?.orders.change ?? 0)}
              deltaTone={deltaTone(s?.orders.change ?? 0)}
              sub={`${awaitingAction} awaiting action`}
              footer={`${allOrders.length} orders in the current window`}
            />
            <KpiCard
              label="Avg order value"
              icon="icon-receipt"
              value={<DcCountUp value={s?.avgOrderValue.value ?? 0} format={formatTaka} />}
              deltaText={delta(s?.avgOrderValue.change ?? 0)}
              deltaTone={deltaTone(s?.avgOrderValue.change ?? 0)}
              sub="per checkout"
              footer={`${s?.customers.value ?? 0} customers in this window`}
            />
            <KpiCard
              label="COD exposure"
              icon="icon-truck"
              value={<DcCountUp value={codExposure} format={formatTaka} />}
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

          <button
            type="button"
            onClick={() => router.push('/dashboard/finance/finance-reports')}
            style={{
              ...card,
              width: '100%',
              textAlign: 'left',
              cursor: 'pointer',
              padding: '16px 18px',
              display: 'grid',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ flex: 1, font: `600 13.5px/1 ${FONT}`, color: 'var(--ink)' }}>
                Financial Pulse
              </span>
              <span style={{ font: `600 12px/1 ${FONT}`, color: 'var(--violet)' }}>
                Profit & Cash Flow →
              </span>
            </div>
            {financePulse.isError ? (
              <span style={{ font: `500 12.5px/1.4 ${FONT}`, color: 'var(--bad)' }}>
                Today’s profit not loaded — API offline. No invented numbers.
              </span>
            ) : financePulse.isLoading ? (
              <span style={{ font: `500 12.5px/1 ${FONT}`, color: 'var(--ink-3)' }}>Loading today…</span>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                  gap: 12,
                }}
              >
                {[
                  ['Sales', formatTaka(financePulse.data?.metrics.grossSales ?? 0)],
                  ['Expenses', formatTaka((financePulse.data?.metrics.opEx ?? 0) + (financePulse.data?.metrics.adSpend ?? 0))],
                  ['Net profit', formatTaka(financePulse.data?.metrics.netProfit ?? 0)],
                  [
                    'Margin',
                    financePulse.data?.metrics.marginPct == null
                      ? '—'
                      : `${financePulse.data.metrics.marginPct}%`,
                  ],
                ].map(([label, value]) => (
                  <div key={label}>
                    <div style={capsLabel}>{label}</div>
                    <div style={{ marginTop: 6, font: `700 18px/1 ${FONT}`, color: 'var(--ink)' }}>
                      {value}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </button>

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
              loading={revenue.isLoading}
            />
            <PipelineCard
              counts={stageCounts}
              total={allOrders.length}
              onOpen={() => router.push('/dashboard/orders')}
              onStage={(id) => router.push(`/dashboard/orders?status=${id}`)}
            />
          </div>

          {/* ── row 3b: charts ─────────────────────────────────────
              Added below the existing rows rather than replacing any of
              them — the stat cards stay exactly where they were. */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))',
              gap: 16,
              alignItems: 'start',
            }}
          >
            <OrdersBarChart points={orderBars} loading={revenue.isLoading} />
            <ConversionFunnelChart steps={funnel.data?.steps ?? []} loading={funnel.isLoading} />
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))',
              gap: 16,
              alignItems: 'start',
            }}
          >
            <PeakHoursChart
              createdAtList={orderCreatedAt}
              loading={orders.isLoading}
              sampleNote={`Dhaka time · last ${allOrders.length} orders`}
            />
            <TrafficSourceChart rows={traffic.data ?? []} loading={traffic.isLoading} />
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

          {/* ── row 5: what is actually selling ─────────────────────── */}
          <BestSellersCard
            items={bestSellers}
            loading={insights.isLoading}
            onOpen={() => router.push('/dashboard/analytics')}
            onProduct={(id) => router.push(`/dashboard/products/${id}/edit`)}
          />

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
  conversion,
  carts,
  goal,
  onSetGoal,
  savingGoal,
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
  /** Orders per cart over 30 days, or null when no carts were recorded. */
  conversion: number | null
  carts: number | null
  goal:
    | { goal: number | null; achieved: number; percent: number | null; remaining: number | null }
    | undefined
  onSetGoal: (value: number | null) => void
  savingGoal: boolean
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

      <GoalBar goal={goal} onSetGoal={onSetGoal} saving={savingGoal} />

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
        {/* The design's third and fourth figures are Conversion and Visitors.
            Conversion is real — orders over carts, from /analytics/funnel.
            Visitors is not: nothing records page views, so the cart count goes
            here instead of a number we would have to invent. */}
        {/* Named for exactly what it measures. Carts here are checkout sessions,
            not browsing sessions, so calling this "conversion" would read as a
            storefront rate it is not. */}
        <SubStat
          label="Cart → order"
          value={conversion == null ? '—' : `${conversion.toFixed(1)}%`}
          sub={conversion == null ? 'no cart data yet' : 'of carts checked out · 30d'}
          subColor="var(--ink-3)"
        />
        <SubStat
          label="Carts"
          value={carts == null ? '—' : String(carts)}
          sub="started · 30d"
          subColor="var(--ink-3)"
        />
      </div>
    </div>
  )
}

/**
 * Progress against the store's own daily revenue target. Until someone sets a
 * target there is nothing honest to draw, so the bar is replaced by the control
 * that sets one.
 */
function GoalBar({
  goal,
  onSetGoal,
  saving,
}: {
  goal: { goal: number | null; achieved: number; percent: number | null; remaining: number | null } | undefined
  onSetGoal: (value: number | null) => void
  saving: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  if (!goal?.goal) {
    return editing ? (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          inputMode="numeric"
          placeholder="Daily revenue goal, e.g. 150000"
          aria-label="Daily revenue goal"
          className="admin-input"
          style={{ flex: 1, minWidth: 0 }}
        />
        <button
          type="button"
          className="admin-btn admin-btn--primary"
          disabled={saving}
          onClick={() => {
            const value = Number(draft.replace(/[^\d.]/g, ''))
            if (!Number.isFinite(value) || value <= 0) return
            onSetGoal(value)
            setEditing(false)
          }}
        >
          {saving ? 'Saving…' : 'Set'}
        </button>
        <button type="button" className="admin-btn admin-btn--ghost" onClick={() => setEditing(false)}>
          Cancel
        </button>
      </div>
    ) : (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="dc-hover-ink"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          alignSelf: 'flex-start',
          height: 30,
          padding: '0 11px',
          borderRadius: 8,
          border: '1px dashed var(--line-2)',
          background: 'transparent',
          color: 'var(--ink-3)',
          cursor: 'pointer',
          font: `600 11.5px/1 ${FONT}`,
        }}
      >
        <DcIcon name="icon-target" size={13} />
        <span>Set a daily revenue goal</span>
      </button>
    )
  }

  const pct = goal.percent ?? 0
  const hit = pct >= 100
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ ...capsLabel, flex: 1 }}>Today&rsquo;s goal · {formatTaka(goal.goal)}</span>
        <span style={{ font: `600 12px/1 ${MONO}`, color: 'var(--ink-2)' }}>{pct}%</span>
        <button
          type="button"
          onClick={() => {
            setDraft(String(goal.goal))
            setEditing(true)
          }}
          title="Change goal"
          aria-label="Change daily revenue goal"
          style={{
            border: 0,
            background: 'transparent',
            color: 'var(--ink-3)',
            cursor: 'pointer',
            padding: 0,
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <DcIcon name="icon-pencil" size={11} />
        </button>
      </div>
      <div
        style={{
          height: 7,
          borderRadius: 99,
          background: 'var(--surface-3)',
          overflow: 'hidden',
          display: 'flex',
        }}
      >
        <span
          style={{
            display: 'block',
            height: '100%',
            width: `${Math.min(100, pct)}%`,
            borderRadius: 99,
            background: hit ? 'var(--ok)' : 'var(--violet)',
          }}
        />
      </div>
      <span style={{ font: `400 11.5px/1 ${FONT}`, color: 'var(--ink-3)' }}>
        {hit
          ? `Goal met · ${formatTaka(goal.achieved)} booked today`
          : `${formatTaka(goal.remaining ?? 0)} to go`}
      </span>
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
  /** What is actually at stake, and in what unit — shown on the action card. */
  impact: string
  impactCaption: string
  impactTone: DcTone
  /** One line on why this outranks the rest, in the operator's terms. */
  why: string
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
  readAt,
  onGo,
}: {
  publishedOut: number
  lowStock: number
  awaitingAction: number
  failedPayments: number
  codRisk: number
  codExposure: number
  codParcels: number
  /** When the underlying counters were last fetched. */
  readAt: number | null
  onGo: (href: string) => void
}) {
  // Both reset on reload — a dismissal is "not this sitting", not a stored
  // preference, and the panel must come back with the next set of numbers.
  const [dismissed, setDismissed] = useState(false)
  const [showWhy, setShowWhy] = useState(false)
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
      impact: String(publishedOut),
      impactCaption: publishedOut === 1 ? 'dead listing' : 'dead listings',
      impactTone: 'bad',
      why: 'These pages take traffic and ad spend and can never convert. Nothing else on this list wastes money as quietly.',
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
      impact: String(failedPayments),
      impactCaption: 'checkouts lost',
      impactTone: 'bad',
      why: 'A customer reached checkout and the money did not land. Recoverable while the intent is fresh.',
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
      impact: String(awaitingAction),
      impactCaption: 'in the queue',
      impactTone: 'warn',
      why: 'Every hour here is an hour added to delivery, and late COD parcels are the ones that get refused.',
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
      impact: formatTaka(codExposure),
      impactCaption: `across ${codParcels} parcel${codParcels === 1 ? '' : 's'}`,
      impactTone: 'warn',
      why: 'Cash the store has already spent stock on but does not hold yet. It settles only when riders remit.',
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
      impact: String(codRisk),
      impactCaption: codRisk === 1 ? 'flagged order' : 'flagged orders',
      impactTone: 'warn',
      why: 'Flagged on the customer’s own history. Confirming by phone before dispatch is cheaper than a return.',
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
      impact: String(lowStock),
      impactCaption: lowStock === 1 ? 'SKU short' : 'SKUs short',
      impactTone: 'warn',
      why: 'Reordering now costs a purchase order. Reordering after they hit zero costs the sales in between.',
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
          {readAt
            ? `read ${new Date(readAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} · `
            : ''}
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

      {top && !dismissed ? (
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
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ ...capsLabel, font: `600 10.5px/1 ${FONT}` }}>Recommended action</span>
              <span style={{ font: `600 13.5px/1.35 ${FONT}`, color: 'var(--ink)' }}>
                {top.text}
              </span>
            </span>
            <span
              style={{
                flex: 'none',
                textAlign: 'right',
                display: 'flex',
                flexDirection: 'column',
                gap: 3,
              }}
            >
              <span
                style={{
                  font: `700 17px/1 ${FONT}`,
                  color: toneStyle(top.impactTone).fg,
                }}
              >
                {top.impact}
              </span>
              <span style={{ font: `500 10px/1 ${FONT}`, color: 'var(--ink-3)' }}>
                {top.impactCaption}
              </span>
            </span>
          </div>
          <span
            style={{ font: `400 11.5px/1.5 ${FONT}`, color: 'var(--ink-3)', textWrap: 'pretty' }}
          >
            {showWhy ? top.why : `Ranked highest of ${signals.length} — read from ${top.source}.`}
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
            <button
              type="button"
              onClick={() => setShowWhy((v) => !v)}
              style={{
                height: 31,
                padding: '0 12px',
                borderRadius: 8,
                border: '1px solid var(--line-2)',
                background: 'var(--surface)',
                color: 'var(--ink-2)',
                cursor: 'pointer',
                font: `600 12px/1 ${FONT}`,
              }}
            >
              {showWhy ? 'Hide reasoning' : 'Why this first'}
            </button>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              style={{
                height: 31,
                padding: '0 12px',
                borderRadius: 8,
                border: 0,
                background: 'transparent',
                color: 'var(--ink-3)',
                cursor: 'pointer',
                font: `600 12px/1 ${FONT}`,
              }}
            >
              Not now
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
  /** String, or a <DcCountUp> when the figure should animate in. */
  value: ReactNode
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
      /* Opts this tile into the shared hover lift in dc.css. */
      className="dc-lift"
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
          {tone === 'mute' ? null : (
            <DcIcon name={tone === 'bad' ? 'icon-trending-down' : 'icon-trending-up'} size={11} />
          )}
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
              : 'No orders in this window. Bars appear the day the first one lands — nothing is drawn from a guess.'
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

/* ── best sellers ────────────────────────────────────────────────── */

interface BestSellerRow {
  id: string
  name: string
  sku: string
  sold: number
  revenue: number
  trend: number
}

/**
 * What is actually moving, ranked by units sold over the insights window.
 * Share bars are drawn against the leader rather than the total, so the top
 * row always fills — the eye compares rows to each other, not to 100%.
 */
function BestSellersCard({
  items,
  onOpen,
  onProduct,
  loading,
}: {
  items: BestSellerRow[]
  onOpen: () => void
  onProduct: (id: string) => void
  loading: boolean
}) {
  const leader = items[0]?.sold ?? 0
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
        <DcIcon name="icon-trending-up" size={14} color="var(--ok)" />
        <span style={{ flex: 1, font: `600 13.5px/1 ${FONT}`, color: 'var(--ink)' }}>
          Best sellers · last 30 days
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
          Full report
        </button>
      </div>

      {items.length === 0 ? (
        <EmptyNote
          text={
            loading
              ? 'Ranking products by units sold…'
              : 'No sales in this window yet — the ranking fills after the first delivered order.'
          }
        />
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 560, borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>#</th>
                <th style={th}>Product</th>
                <th style={th}>Share of top seller</th>
                <th style={{ ...th, textAlign: 'right' }}>Sold</th>
                <th style={{ ...th, textAlign: 'right' }}>Revenue</th>
                <th style={{ ...th, textAlign: 'right' }}>Trend</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p, i) => {
                const pct = leader > 0 ? Math.round((p.sold / leader) * 100) : 0
                const tone = toneStyle(deltaTone(p.trend))
                return (
                  <tr
                    key={p.id}
                    onClick={() => onProduct(p.id)}
                    className="dc-hover-surface"
                    style={{ borderBottom: '1px solid var(--line)', cursor: 'pointer' }}
                  >
                    <td
                      style={{
                        padding: '11px 16px',
                        font: `700 12px/1 ${MONO}`,
                        color: i === 0 ? 'var(--ok)' : 'var(--ink-3)',
                      }}
                    >
                      {i + 1}
                    </td>
                    <td style={{ padding: '11px 16px', minWidth: 180 }}>
                      <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <span style={{ font: `500 13px/1.25 ${FONT}`, color: 'var(--ink)' }}>
                          {p.name}
                        </span>
                        <span style={{ font: `400 11px/1 ${MONO}`, color: 'var(--ink-3)' }}>
                          {p.sku || '—'}
                        </span>
                      </span>
                    </td>
                    <td style={{ padding: '11px 16px', minWidth: 120 }}>
                      <span
                        style={{
                          display: 'block',
                          height: 6,
                          borderRadius: 99,
                          background: 'var(--surface-2)',
                          overflow: 'hidden',
                        }}
                      >
                        <span
                          style={{
                            display: 'block',
                            width: `${pct}%`,
                            height: '100%',
                            borderRadius: 99,
                            background: i === 0 ? 'var(--ok)' : 'var(--violet)',
                          }}
                        />
                      </span>
                    </td>
                    <td
                      style={{
                        padding: '11px 16px',
                        textAlign: 'right',
                        font: `600 13px/1 ${MONO}`,
                        color: 'var(--ink)',
                      }}
                    >
                      {p.sold}
                    </td>
                    <td
                      style={{
                        padding: '11px 16px',
                        textAlign: 'right',
                        font: `600 13px/1 ${MONO}`,
                        color: 'var(--ink-2)',
                      }}
                    >
                      {formatTaka(p.revenue)}
                    </td>
                    <td style={{ padding: '11px 16px', textAlign: 'right' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          padding: '3px 7px',
                          borderRadius: 6,
                          font: `600 11px/1 ${MONO}`,
                          border: `1px solid ${tone.bd}`,
                          background: tone.bg,
                          color: tone.fg,
                        }}
                      >
                        {delta(p.trend)}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
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
