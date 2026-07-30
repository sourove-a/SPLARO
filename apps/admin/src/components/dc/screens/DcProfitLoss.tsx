'use client'

import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

import { DcIcon } from '@/components/dc/DcIcon'
import { DcPageHead } from '@/components/dc/DcPageHead'
import { DcScreenProvider } from '@/components/dc/DcScreenContext'
import { DcEmptyState, DcErrorState, DcLoadingState } from '@/components/dc/blocks/DcStates'
import type { DcBlock } from '@/components/dc/blocks/types'
import { dcPageStatus } from '@/components/dc/page-status'
import { FONT, MONO, formatTaka } from '@/components/dc/tokens'
import { fetchProfitLoss, type ProfitLossSummary } from '@/lib/api/finance'
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

type Period = 'daily' | 'weekly' | 'monthly' | 'yearly'

const PERIODS: Array<{ id: Period; label: string }> = [
  { id: 'daily', label: 'Today' },
  { id: 'weekly', label: 'This week' },
  { id: 'monthly', label: 'This month' },
  { id: 'yearly', label: 'This year' },
]

/** Every line the API deducts from gross revenue, in the order it deducts them. */
const COST_LINES: Array<{ key: keyof ProfitLossSummary['totals']; label: string; why: string }> = [
  { key: 'productCost', label: 'Product cost', why: 'what the goods cost you to buy or make' },
  { key: 'courierCost', label: 'Courier', why: 'delivery charge you actually paid the courier' },
  { key: 'packagingCost', label: 'Packaging', why: 'box, tape, poly, insert' },
  { key: 'paymentGatewayFee', label: 'Gateway fee', why: 'bKash, Nagad, card processing cut' },
  { key: 'discount', label: 'Discounts', why: 'coupons and manual price cuts you gave away' },
  { key: 'returnLoss', label: 'Return loss', why: 'refunds and goods that came back unsellable' },
]

export function DcProfitLoss() {
  const router = useRouter()
  return (
    <DcScreenProvider screen="profit" onNavigate={(next) => router.push(`/dashboard/${next}`)}>
      <DcProfitLossBody />
    </DcScreenProvider>
  )
}

function DcProfitLossBody() {
  const [period, setPeriod] = useState<Period>('monthly')
  const { api } = useAdminConnection(25_000)

  const pl = useQuery({
    queryKey: ['profit-loss', period],
    queryFn: () => fetchProfitLoss(period) as Promise<ProfitLossSummary>,
    staleTime: 60_000,
    retry: 1,
  })

  const pageStatus = dcPageStatus([pl], api.pulse)
  const t = pl.data?.totals
  const orderCount = pl.data?.orderCount ?? 0

  const rows = useMemo(() => {
    if (!t) return []
    const gross = Number(t.grossRevenue || 0)
    return COST_LINES.map((line) => {
      const amount = Number(t[line.key] || 0)
      return {
        ...line,
        amount,
        share: gross > 0 ? (amount / gross) * 100 : 0,
      }
    })
  }, [t])

  const gross = Number(t?.grossRevenue || 0)
  const net = Number(t?.netProfit || 0)
  const totalCost = rows.reduce((s, r) => s + r.amount, 0)
  const margin = gross > 0 ? (net / gross) * 100 : 0
  const perOrderProfit = orderCount > 0 ? net / orderCount : 0
  const perOrderRevenue = orderCount > 0 ? gross / orderCount : 0
  const biggest = rows.slice().sort((a, b) => b.amount - a.amount)[0]

  const skeleton: DcBlock[] = [
    { t: 'seg' } as DcBlock,
    { t: 'kpis' } as DcBlock,
    { t: 'table', w: 'main', title: '', cols: [], rows: [] } as DcBlock,
    { t: 'list', w: 'side', title: '', items: [] } as DcBlock,
  ]

  /** The one sentence a shop owner should read off this page. */
  const verdict =
    margin >= 25
      ? {
          tone: 'var(--ok)',
          bg: 'var(--ok-soft)',
          bd: 'var(--ok-bd)',
          head: `Healthy — ${margin.toFixed(1)}% net margin`,
          body: `You keep ${formatTaka(perOrderProfit)} of every ${formatTaka(perOrderRevenue)} order. Room to spend on acquisition.`,
        }
      : margin >= 10
        ? {
            tone: 'var(--warn)',
            bg: 'var(--warn-soft)',
            bd: 'var(--warn-bd)',
            head: `Thin — ${margin.toFixed(1)}% net margin`,
            body: `${formatTaka(perOrderProfit)} profit per order. ${biggest ? `${biggest.label} is your biggest leak at ${formatTaka(biggest.amount)}.` : ''}`,
          }
        : margin >= 0
          ? {
              tone: 'var(--bad)',
              bg: 'var(--bad-soft)',
              bd: 'var(--bad-bd)',
              head: `Barely breaking even — ${margin.toFixed(1)}% net margin`,
              body: `${biggest ? `${biggest.label} eats ${biggest.share.toFixed(1)}% of revenue.` : ''} One bad return wipes the period out.`,
            }
          : {
              tone: 'var(--bad)',
              bg: 'var(--bad-soft)',
              bd: 'var(--bad-bd)',
              head: `Losing money — ${margin.toFixed(1)}% net margin`,
              body: `Every order costs you ${formatTaka(Math.abs(perOrderProfit))}. ${biggest ? `Start with ${biggest.label} at ${formatTaka(biggest.amount)}.` : ''}`,
            }

  return (
    <>
      <DcPageHead
        crumbGroup="Finance"
        title="Profit & Loss"
        statusLabel={pageStatus.label}
        statusTone={pageStatus.tone}
        syncLabel={
          pl.isFetching
            ? 'syncing…'
            : pl.data?.period
              ? `${fmtDate(pl.data.period.from)} → ${fmtDate(pl.data.period.to)}`
              : 'no period returned'
        }
        syncing={pl.isFetching}
        onSync={() => void pl.refetch()}
      />

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {PERIODS.map((p) => {
          const active = p.id === period
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriod(p.id)}
              style={{
                height: 32,
                padding: '0 13px',
                borderRadius: 99,
                border: `1px solid ${active ? 'var(--violet-solid)' : 'var(--line)'}`,
                background: active ? 'var(--violet-solid)' : 'var(--surface)',
                color: active ? 'var(--on-violet)' : 'var(--ink-2)',
                cursor: 'pointer',
                font: `600 12px/1 ${FONT}`,
              }}
            >
              {p.label}
            </button>
          )
        })}
      </div>

      {pl.isLoading ? (
        <DcLoadingState blocks={skeleton} />
      ) : pl.error ? (
        <DcErrorState
          error={`GET /profit-loss/${period} → ${pl.error instanceof Error ? pl.error.message : '500 Internal Server Error'}`}
          hint="Orders and expenses are unaffected — only this report failed to compute."
          onRetry={() => void pl.refetch()}
        />
      ) : !t ? (
        <DcEmptyState
          icon="icon-trending-up"
          title="No profit data for this period"
          body="The report computes from delivered orders. Nothing was delivered in this window, so there is nothing to split into cost and profit."
        />
      ) : (
        <>
          <div
            style={{
              ...card,
              borderLeft: `3px solid ${verdict.tone}`,
              padding: '14px 16px',
              display: 'flex',
              gap: 12,
              alignItems: 'flex-start',
            }}
          >
            <span
              style={{
                display: 'grid',
                placeItems: 'center',
                width: 30,
                height: 30,
                flex: 'none',
                borderRadius: 9,
                border: `1px solid ${verdict.bd}`,
                background: verdict.bg,
                color: verdict.tone,
              }}
            >
              <DcIcon name="icon-trending-up" size={14} />
            </span>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
              <span style={{ font: `600 14px/1.35 ${FONT}`, color: 'var(--ink)' }}>
                {verdict.head}
              </span>
              <span
                style={{ font: `400 12.5px/1.55 ${FONT}`, color: 'var(--ink-3)', textWrap: 'pretty' }}
              >
                {verdict.body}
              </span>
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(206px, 1fr))',
              gap: 12,
            }}
          >
            <Kpi label="Gross revenue" value={formatTaka(gross)} sub={`${orderCount} order${orderCount === 1 ? '' : 's'} counted`} />
            <Kpi label="Total cost" value={formatTaka(totalCost)} sub={`${gross > 0 ? ((totalCost / gross) * 100).toFixed(1) : '0'}% of revenue`} />
            <Kpi
              label="Net profit"
              value={formatTaka(net)}
              sub={`${margin.toFixed(1)}% margin`}
              color={net >= 0 ? 'var(--ok)' : 'var(--bad)'}
            />
            <Kpi
              label="Per order"
              value={formatTaka(perOrderProfit)}
              sub={`kept out of ${formatTaka(perOrderRevenue)}`}
              color={perOrderProfit >= 0 ? undefined : 'var(--bad)'}
            />
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
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 9,
                    flexWrap: 'wrap',
                    padding: '12px 15px',
                    borderBottom: '1px solid var(--line)',
                  }}
                >
                  <span
                    style={{
                      flex: 1,
                      minWidth: 140,
                      font: `600 13.5px/1.3 ${FONT}`,
                      color: 'var(--ink)',
                    }}
                  >
                    Where the money goes
                  </span>
                  <span style={{ font: `500 11.5px/1 ${FONT}`, color: 'var(--ink-3)' }}>
                    from {formatTaka(gross)} gross
                  </span>
                </div>
                <div style={{ padding: '4px 15px 12px' }}>
                  {rows.map((r) => (
                    <div
                      key={r.key}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                        padding: '11px 0',
                        borderBottom: '1px solid var(--line)',
                      }}
                    >
                      <div
                        style={{ display: 'flex', alignItems: 'baseline', gap: 9, flexWrap: 'wrap' }}
                      >
                        <span
                          style={{
                            flex: 1,
                            minWidth: 100,
                            font: `500 12.5px/1.3 ${FONT}`,
                            color: 'var(--ink)',
                          }}
                        >
                          {r.label}
                        </span>
                        <span style={{ font: `600 13px/1 ${MONO}`, color: 'var(--ink)' }}>
                          −{formatTaka(r.amount)}
                        </span>
                        <span
                          style={{
                            width: 50,
                            textAlign: 'right',
                            font: `500 11.5px/1 ${MONO}`,
                            color: 'var(--ink-3)',
                          }}
                        >
                          {r.share.toFixed(1)}%
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
                            width: `${Math.min(100, r.share)}%`,
                            height: '100%',
                            borderRadius: 99,
                            background:
                              biggest && r.key === biggest.key ? 'var(--warn)' : 'var(--ink-3)',
                          }}
                        />
                      </div>
                      <span style={{ font: `400 11.5px/1.4 ${FONT}`, color: 'var(--ink-3)' }}>
                        {r.why}
                      </span>
                    </div>
                  ))}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: 9,
                      flexWrap: 'wrap',
                      padding: '13px 0 4px',
                    }}
                  >
                    <span
                      style={{
                        flex: 1,
                        minWidth: 100,
                        font: `600 13px/1.3 ${FONT}`,
                        color: 'var(--ink)',
                      }}
                    >
                      Net profit
                    </span>
                    <span
                      style={{
                        font: `700 16px/1 ${MONO}`,
                        color: net >= 0 ? 'var(--ok)' : 'var(--bad)',
                      }}
                    >
                      {formatTaka(net)}
                    </span>
                    <span
                      style={{
                        width: 50,
                        textAlign: 'right',
                        font: `600 11.5px/1 ${MONO}`,
                        color: 'var(--ink-3)',
                      }}
                    >
                      {margin.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ flex: '1 1 28%', minWidth: 290, maxWidth: '100%' }}>
              <div style={{ ...card, padding: '6px 16px 10px' }}>
                <div style={{ padding: '12px 0 9px' }}>
                  <span style={{ font: `600 13.5px/1.3 ${FONT}`, color: 'var(--ink)' }}>
                    How this is computed
                  </span>
                </div>
                {[
                  'Only delivered orders count. Pending and cancelled orders never enter the report.',
                  'Product cost comes from the cost price on each product, not the purchase order.',
                  'Courier cost is what the provider charged, not the delivery fee you collected.',
                  'Return loss covers refunded amounts and stock that came back damaged.',
                  'Partner profit shares are applied after this net figure, in Partner Hub.',
                ].map((line, i) => (
                  <div
                    key={line}
                    style={{
                      display: 'flex',
                      gap: 11,
                      padding: '10px 0',
                      borderTop: '1px solid var(--line)',
                    }}
                  >
                    <span
                      style={{
                        font: `600 10.5px/1.6 ${MONO}`,
                        color: 'var(--ink-3)',
                        flex: 'none',
                      }}
                    >
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span
                      style={{
                        flex: 1,
                        minWidth: 0,
                        font: `400 12px/1.5 ${FONT}`,
                        color: 'var(--ink-2)',
                        textWrap: 'pretty',
                      }}
                    >
                      {line}
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

function fmtDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })
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
