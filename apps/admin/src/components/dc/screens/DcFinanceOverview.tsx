'use client'

import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useMemo } from 'react'

import { DcIcon } from '@/components/dc/DcIcon'
import { DcPageHead } from '@/components/dc/DcPageHead'
import { DcScreenProvider } from '@/components/dc/DcScreenContext'
import { DcEmptyState, DcErrorState, DcLoadingState } from '@/components/dc/blocks/DcStates'
import type { DcBlock } from '@/components/dc/blocks/types'
import { dcPageStatus } from '@/components/dc/page-status'
import { FONT, MONO, formatTaka, toneStyle, type DcTone } from '@/components/dc/tokens'
import { fetchFinanceDashboard, fetchProfitLoss, type ProfitLossSummary } from '@/lib/api/finance'
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

interface Decision {
  key: string
  title: string
  headline: string
  detail: string
  why: string
  tone: DcTone
  cta: string
  href: string
}

export function DcFinanceOverview() {
  const router = useRouter()
  return (
    <DcScreenProvider screen="finance" onNavigate={(next) => router.push(`/dashboard/${next}`)}>
      <DcFinanceOverviewBody />
    </DcScreenProvider>
  )
}

function DcFinanceOverviewBody() {
  const router = useRouter()
  const { api } = useAdminConnection(25_000)

  const dash = useQuery({
    queryKey: ['finance-dashboard'],
    queryFn: fetchFinanceDashboard,
    staleTime: 45_000,
    retry: 1,
  })
  const pl = useQuery({
    queryKey: ['profit-loss', 'monthly'],
    queryFn: () => fetchProfitLoss('monthly') as Promise<ProfitLossSummary>,
    staleTime: 60_000,
    retry: 1,
  })

  const pageStatus = dcPageStatus([dash, pl], api.pulse)
  const totals = dash.data?.totals
  const partners = useMemo(() => dash.data?.partners ?? [], [dash.data])
  const categories = useMemo(
    () => (dash.data?.expensesByCategory ?? []).slice().sort((a, b) => b.amount - a.amount),
    [dash.data],
  )
  const pending = dash.data?.pendingApprovals ?? 0

  const revenue = Number(totals?.revenue || 0)
  const expense = Number(totals?.expense || 0)
  const net = Number(totals?.netProfit || 0)
  const daily = Number(totals?.dailyNetProfit || 0)
  const expenseRatio = revenue > 0 ? (expense / revenue) * 100 : 0
  const combinedBalance = partners.reduce((s, p) => s + Number(p.currentBalance || 0), 0)
  const shareTotal = partners.reduce((s, p) => s + Number(p.sharePercent || 0), 0)
  const topCategory = categories[0]
  const categoryMax = categories.reduce((m, c) => Math.max(m, Number(c.amount || 0)), 0)

  const monthlyMargin = pl.data
    ? Number(pl.data.totals.grossRevenue || 0) > 0
      ? (Number(pl.data.totals.netProfit || 0) / Number(pl.data.totals.grossRevenue || 0)) * 100
      : 0
    : null

  const decisions: Decision[] = [
    ...(pending > 0
      ? [
          {
            key: 'approvals',
            title: 'Expenses waiting for approval',
            headline: String(pending),
            detail: 'nobody has signed these off',
            why: 'Unapproved expenses are missing from net profit, so every number on this page is optimistic until they clear.',
            tone: 'warn' as DcTone,
            cta: 'Open Expenses',
            href: '/dashboard/finance/expenses',
          },
        ]
      : []),
    ...(expenseRatio >= 70
      ? [
          {
            key: 'ratio',
            title: 'Expenses are eating the revenue',
            headline: `${expenseRatio.toFixed(1)}%`,
            detail: `${formatTaka(expense)} spent against ${formatTaka(revenue)} earned`,
            why: topCategory
              ? `${topCategory.category} alone is ${formatTaka(Number(topCategory.amount || 0))}. Cut there first — it moves the number fastest.`
              : 'Categorise the spend before cutting, or you will cut the wrong thing.',
            tone: expenseRatio >= 90 ? ('bad' as DcTone) : ('warn' as DcTone),
            cta: 'Open Expenses',
            href: '/dashboard/finance/expenses',
          },
        ]
      : []),
    ...(net < 0
      ? [
          {
            key: 'loss',
            title: 'The period is running at a loss',
            headline: formatTaka(net),
            detail: 'net after every recorded expense',
            why: 'Partner shares cannot be paid out of a loss. Check Profit & Loss to see which cost line caused it.',
            tone: 'bad' as DcTone,
            cta: 'Open Profit & Loss',
            href: '/dashboard/finance/profit-loss',
          },
        ]
      : []),
    ...(partners.length > 0 && Math.round(shareTotal) !== 100
      ? [
          {
            key: 'shares',
            title: 'Partner shares do not add to 100%',
            headline: `${shareTotal.toFixed(1)}%`,
            detail: `${partners.length} partner${partners.length === 1 ? '' : 's'} on file`,
            why: 'Profit is split by these percentages. While they are wrong, every payout is wrong.',
            tone: 'bad' as DcTone,
            cta: 'Open Partner Hub',
            href: '/dashboard/finance/partner-accounts',
          },
        ]
      : []),
    ...(partners.some((p) => Number(p.currentBalance || 0) < 0)
      ? [
          {
            key: 'negative',
            title: 'A partner balance is negative',
            headline: String(partners.filter((p) => Number(p.currentBalance || 0) < 0).length),
            detail: 'withdrew more than their share earned',
            why: 'That partner owes the business money. Settle it before the next withdrawal is approved.',
            tone: 'warn' as DcTone,
            cta: 'Open Partner Hub',
            href: '/dashboard/finance/partner-accounts',
          },
        ]
      : []),
  ]

  const skeleton: DcBlock[] = [
    { t: 'kpis' } as DcBlock,
    { t: 'decide', title: '', items: [] } as DcBlock,
    { t: 'chart', w: 'main', title: '' } as DcBlock,
    { t: 'table', w: 'side', title: '', cols: [], rows: [] } as DcBlock,
  ]

  const refetchAll = () => {
    void dash.refetch()
    void pl.refetch()
  }

  return (
    <>
      <DcPageHead
        crumbGroup="Finance"
        title="Finance Overview"
        statusLabel={pageStatus.label}
        statusTone={pageStatus.tone}
        syncLabel={
          dash.isFetching || pl.isFetching
            ? 'syncing…'
            : `${partners.length} partner${partners.length === 1 ? '' : 's'} · ${categories.length} expense categor${categories.length === 1 ? 'y' : 'ies'}`
        }
        syncing={dash.isFetching || pl.isFetching}
        onSync={refetchAll}
        actions={[
          {
            label: 'Daily Closing',
            icon: 'icon-calendar-check',
            onClick: () => router.push('/dashboard/finance/daily-closing'),
          },
          {
            label: 'Profit & Loss',
            icon: 'icon-trending-up',
            variant: 'primary',
            onClick: () => router.push('/dashboard/finance/profit-loss'),
          },
        ]}
      />

      {dash.isLoading ? (
        <DcLoadingState blocks={skeleton} />
      ) : dash.error ? (
        <DcErrorState
          error={`GET /finance-reports/dashboard → ${dash.error instanceof Error ? dash.error.message : '500 Internal Server Error'}`}
          hint="Expenses, investments and withdrawals are all still recorded — only this summary failed."
          onRetry={refetchAll}
        />
      ) : !totals ? (
        <DcEmptyState
          icon="icon-file-bar-chart"
          title="No finance data yet"
          body="The overview computes from delivered orders and approved expenses. Once either exists, the numbers appear here."
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
            <Kpi label="Revenue" value={formatTaka(revenue)} sub="delivered orders in the window" />
            <Kpi
              label="Expenses"
              value={formatTaka(expense)}
              sub={`${expenseRatio.toFixed(1)}% of revenue`}
              color={expenseRatio >= 70 ? 'var(--warn)' : undefined}
            />
            <Kpi
              label="Net profit"
              value={formatTaka(net)}
              sub={
                monthlyMargin === null
                  ? pl.error
                    ? 'GET /profit-loss/monthly failed'
                    : 'margin loading…'
                  : `${monthlyMargin.toFixed(1)}% margin this month`
              }
              color={net >= 0 ? 'var(--ok)' : 'var(--bad)'}
            />
            <Kpi
              label="Today"
              value={formatTaka(daily)}
              sub="net profit booked today"
              color={daily >= 0 ? undefined : 'var(--bad)'}
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
                What finance needs from you
              </span>
              <span
                style={{ flex: 1, minWidth: 60, font: `400 11.5px/1.4 ${FONT}`, color: 'var(--ink-3)' }}
              >
                anything that makes the numbers above wrong shows up here
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
                  The books are clean
                </span>
                <span
                  style={{
                    maxWidth: 420,
                    font: `400 12px/1.55 ${FONT}`,
                    color: 'var(--ink-3)',
                    textWrap: 'pretty',
                  }}
                >
                  Nothing pending approval, expenses under control, shares add to 100%, and no
                  partner is overdrawn.
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
                        <span style={{ font: `700 15px/1.2 ${MONO}`, color: tone.fg }}>
                          {d.headline}
                        </span>
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
            <div style={{ flex: '1 1 46%', minWidth: 320, maxWidth: '100%' }}>
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
                      minWidth: 120,
                      font: `600 13.5px/1.3 ${FONT}`,
                      color: 'var(--ink)',
                    }}
                  >
                    Where the spend goes
                  </span>
                  <span style={{ font: `500 11.5px/1 ${FONT}`, color: 'var(--ink-3)' }}>
                    {formatTaka(expense)} total
                  </span>
                </div>
                {categories.length === 0 ? (
                  <Note text="No expenses recorded in this window." />
                ) : (
                  <div style={{ padding: '4px 15px 12px' }}>
                    {categories.map((c, i) => {
                      const amount = Number(c.amount || 0)
                      const width = categoryMax > 0 ? (amount / categoryMax) * 100 : 0
                      return (
                        <div
                          key={`${c.category}-${i}`}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 6,
                            padding: '11px 0',
                            borderBottom:
                              i === categories.length - 1 ? 'none' : '1px solid var(--line)',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'baseline',
                              gap: 9,
                              flexWrap: 'wrap',
                            }}
                          >
                            <span
                              style={{
                                flex: 1,
                                minWidth: 90,
                                font: `500 12.5px/1.3 ${FONT}`,
                                color: 'var(--ink)',
                              }}
                            >
                              {c.category}
                            </span>
                            <span style={{ font: `600 13px/1 ${MONO}`, color: 'var(--ink)' }}>
                              {formatTaka(amount)}
                            </span>
                            <span
                              style={{
                                width: 50,
                                textAlign: 'right',
                                font: `500 11.5px/1 ${MONO}`,
                                color: 'var(--ink-3)',
                              }}
                            >
                              {expense > 0 ? ((amount / expense) * 100).toFixed(1) : '0'}%
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
                                background: i === 0 ? 'var(--warn)' : 'var(--ink-3)',
                              }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            <div style={{ flex: '1 1 46%', minWidth: 320, maxWidth: '100%' }}>
              <div style={{ ...card, overflow: 'auto' }}>
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
                      minWidth: 120,
                      font: `600 13.5px/1.3 ${FONT}`,
                      color: 'var(--ink)',
                    }}
                  >
                    Partner balances
                  </span>
                  <span
                    style={{
                      font: `500 11.5px/1 ${FONT}`,
                      color: Math.round(shareTotal) === 100 ? 'var(--ink-3)' : 'var(--bad)',
                    }}
                  >
                    shares total {shareTotal.toFixed(1)}%
                  </span>
                </div>
                {partners.length === 0 ? (
                  <Note text="No partners on file. Profit is not being split." />
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={th}>Partner</th>
                        <th style={{ ...th, textAlign: 'right' }}>Share</th>
                        <th style={{ ...th, textAlign: 'right' }}>Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {partners.map((p) => {
                        const bal = Number(p.currentBalance || 0)
                        return (
                          <tr key={p.id} style={{ borderBottom: '1px solid var(--line)' }}>
                            <td
                              style={{
                                padding: '10px 15px',
                                font: `500 13px/1.3 ${FONT}`,
                                color: 'var(--ink)',
                              }}
                            >
                              {p.name}
                            </td>
                            <td
                              style={{
                                padding: '10px 15px',
                                textAlign: 'right',
                                font: `600 12.5px/1 ${MONO}`,
                                color: 'var(--ink-2)',
                              }}
                            >
                              {Number(p.sharePercent || 0).toFixed(1)}%
                            </td>
                            <td
                              style={{
                                padding: '10px 15px',
                                textAlign: 'right',
                                font: `600 13px/1 ${MONO}`,
                                color: bal < 0 ? 'var(--bad)' : 'var(--ink)',
                              }}
                            >
                              {formatTaka(bal)}
                            </td>
                          </tr>
                        )
                      })}
                      <tr>
                        <td
                          style={{
                            padding: '10px 15px',
                            font: `600 12.5px/1.3 ${FONT}`,
                            color: 'var(--ink-3)',
                          }}
                        >
                          Combined
                        </td>
                        <td />
                        <td
                          style={{
                            padding: '10px 15px',
                            textAlign: 'right',
                            font: `700 13px/1 ${MONO}`,
                            color: 'var(--ink)',
                          }}
                        >
                          {formatTaka(combinedBalance)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </>
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
