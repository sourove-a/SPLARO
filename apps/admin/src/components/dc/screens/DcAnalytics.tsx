'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

import { DcIcon } from '@/components/dc/DcIcon'
import { DcPageHead } from '@/components/dc/DcPageHead'
import { DcScreenProvider } from '@/components/dc/DcScreenContext'
import { DcEmptyState, DcErrorState, DcLoadingState } from '@/components/dc/blocks/DcStates'
import type { DcBlock } from '@/components/dc/blocks/types'
import { dcPageStatus } from '@/components/dc/page-status'
import {
  FONT,
  MONO,
  deltaTone,
  formatDelta,
  formatTaka,
  toneStyle,
  type DcTone,
} from '@/components/dc/tokens'
import { useDashboardInsights, useDashboardStats } from '@/lib/api/hooks'
import { useAdminConnection } from '@/lib/hooks/use-admin-connection'
import { downloadCsv } from '@/lib/admin/admin-actions'
import { toastOk, toastWarn } from '@/lib/admin/feedback'

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
  padding: '9px 15px',
  font: `600 10.5px/1 ${FONT}`,
  letterSpacing: '.09em',
  textTransform: 'uppercase' as const,
  color: 'var(--ink-3)',
  borderBottom: '1px solid var(--line)',
  whiteSpace: 'nowrap' as const,
}

const td = { padding: '10px 15px', font: `400 12.5px/1.4 ${FONT}`, color: 'var(--ink-2)' } as const

/** Labels `periodFromLabel()` understands — anything else silently becomes 30d. */
const PERIODS = ['Today', '7 Days', '30 Days', 'Quarter'] as const
type PeriodLabel = (typeof PERIODS)[number]

const ACTIVITY_ICON: Record<string, string> = {
  order: 'icon-shopping-cart',
  customer: 'icon-user-plus',
  payment: 'icon-credit-card',
  shipping: 'icon-truck',
}

export function DcAnalytics() {
  const router = useRouter()
  return (
    <DcScreenProvider screen="analytics" onNavigate={(next) => router.push(`/dashboard/${next}`)}>
      <DcAnalyticsBody />
    </DcScreenProvider>
  )
}

function DcAnalyticsBody() {
  const router = useRouter()
  const [period, setPeriod] = useState<PeriodLabel>('30 Days')
  const stats = useDashboardStats(period)
  const insights = useDashboardInsights(period)
  const { api } = useAdminConnection(25_000)

  const pageStatus = dcPageStatus([stats, insights], api.pulse)
  const s = stats.data
  const topProducts = useMemo(() => insights.data?.topProducts ?? [], [insights.data])
  const topCategories = useMemo(() => insights.data?.topCategories ?? [], [insights.data])
  const paymentMix = useMemo(() => insights.data?.paymentMix ?? [], [insights.data])
  const activity = useMemo(() => insights.data?.recentActivities ?? [], [insights.data])

  const revenue = Number(s?.revenue.value || 0)
  const orders = Number(s?.orders.value || 0)
  const aov = Number(s?.avgOrderValue.value || 0)
  const codRisk = s?.alerts.codRiskOrders ?? 0
  const failedPayments = s?.alerts.failedPayments ?? 0

  const categoryMax = topCategories.reduce((m, c) => Math.max(m, Number(c.revenue || 0)), 0)
  const paymentTotal = insights.data?.paymentMixTotal ?? 0
  const topSlice = paymentMix.slice().sort((a, b) => Number(b.revenue) - Number(a.revenue))[0]
  const concentration =
    topCategories.length > 0 && revenue > 0
      ? (Number(topCategories[0]?.revenue || 0) / revenue) * 100
      : 0

  const decisions: Array<{
    key: string
    title: string
    headline: string
    detail: string
    why: string
    tone: DcTone
    cta?: { label: string; href: string }
  }> = [
    ...(failedPayments > 0
      ? [
          {
            key: 'failed-payments',
            title: 'Payments that did not go through',
            headline: String(failedPayments),
            detail: 'orders sitting unpaid',
            why: 'Revenue above already excludes these. Each one is a customer who tried to pay you and could not.',
            tone: 'bad' as DcTone,
            cta: { label: 'Open Orders', href: '/dashboard/orders' },
          },
        ]
      : []),
    ...(codRisk > 0
      ? [
          {
            key: 'cod-risk',
            title: 'COD orders flagged as risky',
            headline: String(codRisk),
            detail: 'counted in revenue, not yet collected',
            why: 'COD revenue is only real once the rider hands over cash. Ask for advance payment before dispatch.',
            tone: 'warn' as DcTone,
            cta: { label: 'Open Orders', href: '/dashboard/orders' },
          },
        ]
      : []),
    ...(concentration >= 60
      ? [
          {
            key: 'concentration',
            title: 'One category carries the store',
            headline: `${concentration.toFixed(0)}%`,
            detail: `${topCategories[0]?.name ?? 'the top category'} of all revenue`,
            why: 'A single supplier problem or a single trend ending takes most of the revenue with it.',
            tone: 'warn' as DcTone,
            cta: { label: 'Open Collections', href: '/dashboard/collections' },
          },
        ]
      : []),
    ...(s && s.orders.change < -10
      ? [
          {
            key: 'orders-down',
            title: 'Order count is falling',
            headline: formatDelta(s.orders.change),
            detail: `${orders} orders this period`,
            why: 'Fewer orders at a steady basket size is a traffic problem, not a pricing one. Check campaigns before discounting.',
            tone: 'bad' as DcTone,
            cta: { label: 'Open Campaigns', href: '/dashboard/campaigns' },
          },
        ]
      : []),
    ...(s && s.avgOrderValue.change < -10 && s.orders.change >= 0
      ? [
          {
            key: 'aov-down',
            title: 'Baskets are getting smaller',
            headline: formatDelta(s.avgOrderValue.change),
            detail: `${formatTaka(aov)} average order`,
            why: 'Order count held but each one is worth less — usually discounting or a shift to cheaper SKUs.',
            tone: 'warn' as DcTone,
            cta: { label: 'Open Coupons', href: '/dashboard/coupons' },
          },
        ]
      : []),
  ]

  const skeleton: DcBlock[] = [
    { t: 'seg' } as DcBlock,
    { t: 'kpis' } as DcBlock,
    { t: 'decide', title: '', items: [] } as DcBlock,
    { t: 'table', w: 'main', title: '', cols: [], rows: [] } as DcBlock,
    { t: 'list', w: 'side', title: '', items: [] } as DcBlock,
  ]

  const refetchAll = () => {
    void stats.refetch()
    void insights.refetch()
  }

  const exportCsv = () => {
    if (!s) {
      toastWarn('No analytics data to export')
      return
    }
    const csvRows = [
      ['Metric', 'Value', 'Change vs Prior Period'],
      ['Revenue (BDT)', String(revenue), `${s.revenue.change}%`],
      ['Orders', String(orders), `${s.orders.change}%`],
      ['Customers', String(s.customers.value || 0), `${s.customers.change}%`],
      ['Average Order Value (BDT)', String(aov), `${s.avgOrderValue.change}%`],
      ['COD Risk Orders', String(codRisk), '—'],
      ['Failed Payments', String(failedPayments), '—'],
      [],
      ['Top Products', 'Revenue (BDT)', 'Quantity Sold'],
      ...topProducts.map((p) => [p.name, String(p.revenue), String(p.sold)]),
      [],
      ['Top Categories', 'Revenue (BDT)', 'Orders Count'],
      ...topCategories.map((c) => [c.name, String(c.revenue), String(c.orders)]),
      [],
      ['Payment Method', 'Revenue (BDT)', 'Transaction Count'],
      ...paymentMix.map((pm) => [pm.name, String(pm.revenue), String(pm.count)]),
    ]
    downloadCsv(
      `splaro-analytics-${period.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.csv`,
      csvRows,
    )
    toastOk(`Analytics report (${period}) exported`)
  }

  return (
    <>
      <DcPageHead
        crumbGroup="Overview"
        title="Analytics"
        statusLabel={pageStatus.label}
        statusTone={pageStatus.tone}
        syncLabel={
          stats.isFetching || insights.isFetching
            ? 'syncing…'
            : `${period.toLowerCase()} · ${orders} order${orders === 1 ? '' : 's'}`
        }
        syncing={stats.isFetching || insights.isFetching}
        onSync={refetchAll}
        actions={[
          {
            label: 'Export CSV',
            icon: 'icon-download',
            onClick: exportCsv,
          },
          {
            label: 'Profit & Loss',
            icon: 'icon-trending-up',
            variant: 'primary',
            onClick: () => router.push('/dashboard/finance/profit-loss'),
          },
        ]}
      />

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {PERIODS.map((p) => {
          const on = p === period
          return (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              style={{
                height: 32,
                padding: '0 13px',
                borderRadius: 99,
                border: `1px solid ${on ? 'var(--violet-solid)' : 'var(--line)'}`,
                background: on ? 'var(--violet-solid)' : 'var(--surface)',
                color: on ? 'var(--on-violet)' : 'var(--ink-2)',
                cursor: 'pointer',
                font: `600 12px/1 ${FONT}`,
              }}
            >
              {p}
            </button>
          )
        })}
      </div>

      {stats.isLoading ? (
        <DcLoadingState blocks={skeleton} />
      ) : stats.error ? (
        <DcErrorState
          error={`GET /admin/dashboard/stats → ${stats.error instanceof Error ? stats.error.message : '500 Internal Server Error'}`}
          hint="Orders and payments are unaffected — only this report failed to compute."
          onRetry={refetchAll}
        />
      ) : !s ? (
        <DcEmptyState
          icon="icon-bar-chart-3"
          title="No analytics for this period"
          body="Nothing was ordered in this window, so there is nothing to chart. Try a longer period."
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
              label="Revenue"
              value={formatTaka(revenue)}
              change={s.revenue.change}
              sub="delivered and paid orders"
            />
            <Kpi
              label="Orders"
              value={orders.toLocaleString('en-IN')}
              change={s.orders.change}
              sub={`${codRisk} flagged COD risk`}
            />
            <Kpi
              label="Customers"
              value={Number(s.customers.value || 0).toLocaleString('en-IN')}
              change={s.customers.change}
              sub="people who ordered in this window"
            />
            <Kpi
              label="Average order"
              value={formatTaka(aov)}
              change={s.avgOrderValue.change}
              sub="what a typical basket is worth"
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
                What the numbers are telling you
              </span>
              <span
                style={{ flex: 1, minWidth: 60, font: `400 11.5px/1.4 ${FONT}`, color: 'var(--ink-3)' }}
              >
                read this before the charts
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
                  Nothing alarming in this period
                </span>
                <span
                  style={{
                    maxWidth: 420,
                    font: `400 12px/1.55 ${FONT}`,
                    color: 'var(--ink-3)',
                    textWrap: 'pretty',
                  }}
                >
                  No failed payments, no COD flags, revenue is not concentrated in a single
                  category, and neither order count nor basket size is falling.
                </span>
              </div>
            ) : (
              <div
                style={{
                  padding: 12,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(min(330px, 100%), 1fr))',
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
                        <span style={{ font: `700 15px/1.2 ${MONO}`, color: tone.fg }}>
                          {d.headline}
                        </span>
                        <span
                          style={{
                            flex: 1,
                            minWidth: 0,
                            font: `500 11.5px/1.4 ${FONT}`,
                            color: 'var(--ink-3)',
                          }}
                        >
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
                      {d.cta ? (
                        <button
                          type="button"
                          onClick={() => router.push(d.cta!.href)}
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
                          {d.cta.label}
                        </button>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {insights.error ? (
            <DcErrorState
              error={`GET /admin/dashboard/insights → ${insights.error instanceof Error ? insights.error.message : '500 Internal Server Error'}`}
              hint="The totals above still loaded — only the product, category and payment breakdowns failed."
              onRetry={() => void insights.refetch()}
            />
          ) : (
            <>
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
                  <div style={{ ...card, overflow: 'auto' }}>
                    <SectionHead
                      title="What sold"
                      meta={`${topProducts.length} product${topProducts.length === 1 ? '' : 's'}`}
                    />
                    {topProducts.length === 0 ? (
                      <Note text="Nothing sold in this period." />
                    ) : (
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', minWidth: 700, borderCollapse: 'collapse' }}>
                        <thead>
                          <tr>
                            <th style={{ ...th, textAlign: 'right' }}>#</th>
                            <th style={th}>Product</th>
                            <th style={th}>SKU</th>
                            <th style={{ ...th, textAlign: 'right' }}>Units</th>
                            <th style={{ ...th, textAlign: 'right' }}>Revenue</th>
                            <th style={{ ...th, textAlign: 'right' }}>Trend</th>
                          </tr>
                        </thead>
                        <tbody>
                          {topProducts.map((p) => {
                            const trend = toneStyle(deltaTone(Number(p.trend || 0)))
                            return (
                              <tr key={p.id} style={{ borderBottom: '1px solid var(--line)' }}>
                                <td
                                  style={{
                                    ...td,
                                    textAlign: 'right',
                                    font: `600 12px/1 ${MONO}`,
                                    color: 'var(--ink-3)',
                                  }}
                                >
                                  {p.rank}
                                </td>
                                <td style={{ ...td, color: 'var(--ink)', font: `500 13px/1.3 ${FONT}` }}>
                                  {p.name}
                                </td>
                                <td style={{ ...td, font: `400 11.5px/1 ${MONO}`, color: 'var(--ink-3)' }}>
                                  {p.sku || '—'}
                                </td>
                                <td
                                  style={{
                                    ...td,
                                    textAlign: 'right',
                                    font: `600 12.5px/1 ${MONO}`,
                                    color: 'var(--ink)',
                                  }}
                                >
                                  {Number(p.sold || 0).toLocaleString('en-IN')}
                                </td>
                                <td
                                  style={{
                                    ...td,
                                    textAlign: 'right',
                                    font: `600 13px/1 ${MONO}`,
                                    color: 'var(--ink)',
                                  }}
                                >
                                  {formatTaka(Number(p.revenue || 0))}
                                </td>
                                <td style={{ ...td, textAlign: 'right' }}>
                                  <span
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 4,
                                      padding: '2px 7px',
                                      borderRadius: 6,
                                      border: `1px solid ${trend.bd}`,
                                      background: trend.bg,
                                      color: trend.fg,
                                      font: `600 11px/1 ${MONO}`,
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    {formatDelta(Number(p.trend || 0))}
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
                </div>

                <div style={{ flex: '1 1 28%', minWidth: 290, maxWidth: '100%' }}>
                  <div style={{ ...card, overflow: 'hidden' }}>
                    <SectionHead title="Where revenue comes from" meta="by category" />
                    {topCategories.length === 0 ? (
                      <Note text="No category revenue in this period." />
                    ) : (
                      <div style={{ padding: '4px 15px 12px' }}>
                        {topCategories.map((c, i) => {
                          const rev = Number(c.revenue || 0)
                          const width = categoryMax > 0 ? (rev / categoryMax) * 100 : 0
                          return (
                            <div
                              key={c.id}
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 6,
                                padding: '11px 0',
                                borderBottom:
                                  i === topCategories.length - 1 ? 'none' : '1px solid var(--line)',
                              }}
                            >
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'baseline',
                                  gap: 8,
                                  flexWrap: 'wrap',
                                }}
                              >
                                <span
                                  style={{
                                    flex: 1,
                                    minWidth: 80,
                                    font: `500 12.5px/1.3 ${FONT}`,
                                    color: 'var(--ink)',
                                  }}
                                >
                                  {c.name}
                                </span>
                                <span style={{ font: `600 12.5px/1 ${MONO}`, color: 'var(--ink)' }}>
                                  {formatTaka(rev)}
                                </span>
                              </div>
                              <div
                                style={{
                                  height: 5,
                                  borderRadius: 99,
                                  background: 'var(--surface-3)',
                                  overflow: 'hidden',
                                }}
                              >
                                <div
                                  style={{
                                    width: `${Math.min(100, width)}%`,
                                    height: '100%',
                                    borderRadius: 99,
                                    background: i === 0 ? 'var(--violet-solid)' : 'var(--ink-3)',
                                  }}
                                />
                              </div>
                              <span
                                style={{ font: `400 11px/1.4 ${FONT}`, color: 'var(--ink-3)' }}
                              >
                                {Number(c.share || 0).toFixed(1)}% of revenue ·{' '}
                                {Number(c.orders || 0)} order
                                {Number(c.orders || 0) === 1 ? '' : 's'}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
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
                <div style={{ flex: '1 1 46%', minWidth: 300, maxWidth: '100%' }}>
                  <div style={{ ...card, overflow: 'hidden' }}>
                    <SectionHead
                      title="How they paid"
                      meta={topSlice ? `${topSlice.name} leads` : 'no payments'}
                    />
                    {paymentMix.length === 0 ? (
                      <Note text="No payments recorded in this period." />
                    ) : (
                      <div style={{ padding: '4px 15px 12px' }}>
                        {paymentMix.map((m, i) => {
                          const share =
                            paymentTotal > 0 ? (Number(m.value || 0) / paymentTotal) * 100 : 0
                          return (
                            <div
                              key={`${m.name}-${i}`}
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 6,
                                padding: '11px 0',
                                borderBottom:
                                  i === paymentMix.length - 1 ? 'none' : '1px solid var(--line)',
                              }}
                            >
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'baseline',
                                  gap: 8,
                                  flexWrap: 'wrap',
                                }}
                              >
                                <span
                                  style={{
                                    flex: 1,
                                    minWidth: 80,
                                    font: `500 12.5px/1.3 ${FONT}`,
                                    color: 'var(--ink)',
                                  }}
                                >
                                  {m.name}
                                </span>
                                <span style={{ font: `600 12.5px/1 ${MONO}`, color: 'var(--ink)' }}>
                                  {formatTaka(Number(m.revenue || 0))}
                                </span>
                                <span
                                  style={{
                                    width: 46,
                                    textAlign: 'right',
                                    font: `500 11.5px/1 ${MONO}`,
                                    color: 'var(--ink-3)',
                                  }}
                                >
                                  {share.toFixed(1)}%
                                </span>
                              </div>
                              <div
                                style={{
                                  height: 5,
                                  borderRadius: 99,
                                  background: 'var(--surface-3)',
                                  overflow: 'hidden',
                                }}
                              >
                                <div
                                  style={{
                                    width: `${Math.min(100, share)}%`,
                                    height: '100%',
                                    borderRadius: 99,
                                    background: i === 0 ? 'var(--violet-solid)' : 'var(--ink-3)',
                                  }}
                                />
                              </div>
                              <span style={{ font: `400 11px/1.4 ${FONT}`, color: 'var(--ink-3)' }}>
                                {Number(m.count || 0)} order
                                {Number(m.count || 0) === 1 ? '' : 's'}
                                {/^cod$|cash/i.test(m.name)
                                  ? ' — cash you only hold once the rider returns'
                                  : ''}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ flex: '1 1 46%', minWidth: 300, maxWidth: '100%' }}>
                  <div style={{ ...card, padding: '6px 16px 10px' }}>
                    <div style={{ padding: '12px 0 9px' }}>
                      <span style={{ font: `600 13.5px/1.3 ${FONT}`, color: 'var(--ink)' }}>
                        What just happened
                      </span>
                    </div>
                    {activity.length === 0 ? (
                      <div
                        style={{
                          padding: '26px 0',
                          textAlign: 'center',
                          font: `400 12.5px/1.55 ${FONT}`,
                          color: 'var(--ink-3)',
                          borderTop: '1px solid var(--line)',
                        }}
                      >
                        Nothing has happened in this period yet.
                      </div>
                    ) : (
                      activity.slice(0, 12).map((a) => (
                        <div
                          key={a.id}
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
                            <DcIcon name={ACTIVITY_ICON[a.type] ?? 'icon-activity'} size={12} />
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
                            <span
                              style={{
                                font: `400 12.5px/1.45 ${FONT}`,
                                color: 'var(--ink-2)',
                                textWrap: 'pretty',
                              }}
                            >
                              {a.message}
                            </span>
                            <span style={{ font: `400 11px/1 ${MONO}`, color: 'var(--ink-3)' }}>
                              {new Date(a.at).toLocaleString('en-GB', {
                                day: '2-digit',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* The design also asks for traffic analytics. Nothing in this API
                  answers those, so the page names the gap instead of drawing it. */}
              <div style={{ ...card, padding: '6px 16px 10px' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 9,
                    flexWrap: 'wrap',
                    padding: '12px 0 9px',
                  }}
                >
                  <span
                    style={{ flex: 1, minWidth: 150, font: `600 13.5px/1.3 ${FONT}`, color: 'var(--ink)' }}
                  >
                    Not shown here, and why
                  </span>
                  <span style={{ font: `500 11.5px/1 ${FONT}`, color: 'var(--ink-3)' }}>
                    no endpoint answers these yet
                  </span>
                </div>
                {[
                  {
                    icon: 'icon-users',
                    title: 'Sessions and visitors',
                    sub: 'needs a GA4 property wired to the API — order data alone cannot count people who did not buy',
                  },
                  {
                    icon: 'icon-percent',
                    title: 'Conversion rate',
                    sub: 'orders ÷ sessions. Without sessions this would be a made-up denominator',
                  },
                  {
                    icon: 'icon-smartphone',
                    title: 'Device and peak-hour split',
                    sub: 'lives in analytics, not in the order table',
                  },
                  {
                    icon: 'icon-share-2',
                    title: 'Traffic source and CAC',
                    sub: 'needs ad-platform spend joined to attributed orders',
                  },
                ].map((g) => (
                  <div
                    key={g.title}
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
                        width: 28,
                        height: 28,
                        flex: 'none',
                        borderRadius: 8,
                        border: '1px solid var(--line)',
                        background: 'var(--surface-2)',
                        color: 'var(--ink-3)',
                      }}
                    >
                      <DcIcon name={g.icon} size={13} />
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
                      <span style={{ font: `600 12.5px/1.3 ${FONT}`, color: 'var(--ink-2)' }}>
                        {g.title}
                      </span>
                      <span
                        style={{
                          font: `400 11.5px/1.45 ${FONT}`,
                          color: 'var(--ink-3)',
                          textWrap: 'pretty',
                        }}
                      >
                        {g.sub}
                      </span>
                    </span>
                    <span
                      style={{
                        flex: 'none',
                        alignSelf: 'flex-start',
                        padding: '3px 8px',
                        borderRadius: 6,
                        border: '1px solid var(--line-2)',
                        color: 'var(--ink-3)',
                        font: `700 9px/1.4 ${FONT}`,
                        letterSpacing: '.08em',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      NO DATA
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </>
  )
}

function SectionHead({ title, meta }: { title: string; meta: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flexWrap: 'wrap',
        padding: '12px 15px',
        borderBottom: '1px solid var(--line)',
      }}
    >
      <span style={{ flex: 1, minWidth: 130, font: `600 13.5px/1.3 ${FONT}`, color: 'var(--ink)' }}>
        {title}
      </span>
      <span style={{ font: `500 11.5px/1 ${FONT}`, color: 'var(--ink-3)' }}>{meta}</span>
    </div>
  )
}

function Note({ text }: { text: string }) {
  return (
    <div
      style={{
        padding: '40px 15px',
        textAlign: 'center',
        font: `400 12.5px/1.55 ${FONT}`,
        color: 'var(--ink-3)',
      }}
    >
      {text}
    </div>
  )
}

function Kpi({
  label,
  value,
  sub,
  change,
}: {
  label: string
  value: string
  sub: string
  change: number
}) {
  const tone = toneStyle(deltaTone(change))
  return (
    <div
      style={{ ...card, padding: '14px 15px 13px', display: 'flex', flexDirection: 'column', gap: 8 }}
    >
      <span style={capsLabel}>{label}</span>
      <span style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ font: `700 25px/1 ${FONT}`, letterSpacing: '-.025em', color: 'var(--ink)' }}>
          {value}
        </span>
        <span
          style={{
            padding: '2px 7px',
            borderRadius: 6,
            border: `1px solid ${tone.bd}`,
            background: tone.bg,
            color: tone.fg,
            font: `600 11px/1.3 ${MONO}`,
            whiteSpace: 'nowrap',
          }}
        >
          {formatDelta(change)}
        </span>
      </span>
      <span style={{ font: `400 11.5px/1.35 ${FONT}`, color: 'var(--ink-3)' }}>
        {sub} · vs previous period
      </span>
    </div>
  )
}
