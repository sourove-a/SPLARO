'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

import { DcIcon } from '@/components/dc/DcIcon'
import { DcPageHead } from '@/components/dc/DcPageHead'
import { DcScreenProvider, useDcScreen } from '@/components/dc/DcScreenContext'
import { DcErrorState, DcLoadingState } from '@/components/dc/blocks/DcStates'
import { DcModal } from '@/components/dc/DcModal'
import type { DcBlock } from '@/components/dc/blocks/types'
import { FONT, MONO, formatTaka, toneStyle, type DcTone } from '@/components/dc/tokens'
import { useClientNow } from '@/components/dc/useClientNow'
import { fetchDailyClosings, runDailyClosing } from '@/lib/api/finance'

interface DailyClosingRow {
  id: string
  closingDate: string
  totalOrders: number
  totalRevenue: number | string
  totalExpenses: number | string
  netProfit: number | string
  status: string
  closedBy?: string | null
}

const card = {
  border: '1px solid var(--line)',
  borderRadius: 14,
  background: 'var(--surface)',
  backgroundImage: 'var(--card-sheen)',
} as const

const STATUS_TONE: Record<string, DcTone> = {
  LOCKED: 'ok',
  CLOSED: 'ok',
  OPEN: 'warn',
  PENDING: 'warn',
}

function isoDay(d: Date) {
  return d.toISOString().slice(0, 10)
}

export function DcDailyClosing() {
  const router = useRouter()
  return (
    <DcScreenProvider screen="dailyclose" onNavigate={(next) => router.push(`/dashboard/${next}`)}>
      <DcDailyClosingBody />
    </DcScreenProvider>
  )
}

function DcDailyClosingBody() {
  const router = useRouter()
  const { toast } = useDcScreen()
  const qc = useQueryClient()
  const [counted, setCounted] = useState('')
  const [reason, setReason] = useState('')
  const [locking, setLocking] = useState(false)
  const [confirmLock, setConfirmLock] = useState(false)
  const now = useClientNow()

  const closings = useQuery({
    queryKey: ['daily-closings'],
    queryFn: () => fetchDailyClosings(1, 30),
    staleTime: 30_000,
  })

  const rows = useMemo(
    () => (closings.data?.items ?? []) as DailyClosingRow[],
    [closings.data],
  )
  const today = useMemo(
    () => (now ? rows.find((r) => String(r.closingDate).slice(0, 10) === isoDay(now)) : undefined),
    [rows, now],
  )
  const latest = today ?? rows[0]

  const expected = Number(latest?.totalRevenue ?? 0) - Number(latest?.totalExpenses ?? 0)
  const countedNum = Number(counted.replace(/[^0-9.-]/g, ''))
  const variance = counted.trim() === '' ? null : countedNum - expected
  const dayLocked = (latest?.status ?? '').toUpperCase() !== 'OPEN' && !!today

  const lock = async () => {
    setLocking(true)
    try {
      await runDailyClosing()
      const res = await fetchDailyClosings(1, 30)
      const fresh = (res.items ?? []) as DailyClosingRow[]
      await qc.setQueryData(['daily-closings'], res)
      const day = now ? isoDay(now) : new Date().toISOString().slice(0, 10)
      const lockedToday = fresh.find(
        (row) =>
          String(row.closingDate).slice(0, 10) === day &&
          String(row.status).toUpperCase() !== 'OPEN',
      )
      if (!lockedToday) {
        toast(
          'bad',
          'Closing not verified',
          "API responded but today's locked record was not found — refresh and retry.",
        )
        return
      }
      setConfirmLock(false)
      toast('ok', 'Day locked', "Today's closing record is on the server.")
    } catch (err) {
      toast(
        'bad',
        'Could not lock the day',
        err instanceof Error ? err.message : 'POST /daily-closing/run failed',
      )
    } finally {
      setLocking(false)
    }
  }

  const skeleton: DcBlock[] = [
    { t: 'list', w: 'main', title: '', items: [] },
    { t: 'form', w: 'side', title: '', fields: [] },
  ]

  const pageStatus = closings.error
    ? { label: 'ERROR' as const, tone: 'bad' as const }
    : dayLocked
      ? { label: 'LOCKED' as const, tone: 'ok' as const }
      : { label: 'OPEN' as const, tone: 'warn' as const }

  return (
    <>
      <DcPageHead
        crumbGroup="Finance · Daily Closing"
        title="Daily Closing"
        statusLabel={pageStatus.label}
        statusTone={pageStatus.tone}
        syncLabel={
          now
            ? now.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
            : 'today'
        }
        syncing={closings.isFetching}
        onSync={() => void closings.refetch()}
        actions={[
          {
            label: 'History',
            icon: 'icon-calendar',
            onClick: () => router.push('/dashboard/finance/finance-reports'),
          },
        ]}
      />

      {closings.isLoading ? (
        <DcLoadingState blocks={skeleton} />
      ) : closings.error ? (
        <DcErrorState
          error={`GET /daily-closing → ${closings.error instanceof Error ? closings.error.message : '500 Internal Server Error'}`}
          hint="Nothing has been locked or lost — only this view failed to load."
          onRetry={() => void closings.refetch()}
        />
      ) : (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 16,
            alignItems: 'flex-start',
            width: '100%',
          }}
        >
          <div
            style={{
              flex: '1 1 56%',
              minWidth: 340,
              maxWidth: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            <div style={{ ...card, overflow: 'hidden' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '12px 15px',
                  borderBottom: '1px solid var(--line)',
                }}
              >
                <span style={{ flex: 1, font: `600 13.5px/1 ${FONT}`, color: 'var(--ink)' }}>
                  Collections ·{' '}
                  {latest
                    ? new Date(latest.closingDate).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric',
                      })
                    : 'today'}
                </span>
                <StatusChip status={latest?.status ?? 'OPEN'} />
              </div>

              <div style={{ padding: '6px 16px 12px' }}>
                <MoneyRow
                  icon="icon-shopping-bag"
                  color="var(--violet)"
                  label="Gross revenue"
                  sub={`${latest?.totalOrders ?? 0} orders counted`}
                  amount={formatTaka(Number(latest?.totalRevenue ?? 0))}
                />
                <MoneyRow
                  icon="icon-receipt"
                  color="var(--warn)"
                  label="Expenses"
                  sub="courier, packaging, ads and salaries"
                  amount={`− ${formatTaka(Number(latest?.totalExpenses ?? 0))}`}
                />
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    paddingTop: 13,
                    marginTop: 4,
                    borderTop: '1px solid var(--line-2)',
                  }}
                >
                  <span style={{ flex: 1, font: `600 13px/1 ${FONT}`, color: 'var(--ink)' }}>
                    Net for the day
                  </span>
                  <span
                    style={{
                      font: `700 22px/1 ${MONO}`,
                      color: Number(latest?.netProfit ?? 0) < 0 ? 'var(--bad)' : 'var(--ok)',
                    }}
                  >
                    {formatTaka(Number(latest?.netProfit ?? expected))}
                  </span>
                </div>
              </div>
            </div>

            <div style={{ ...card, overflow: 'hidden' }}>
              <div
                style={{
                  padding: '12px 15px',
                  borderBottom: '1px solid var(--line)',
                  font: `600 13.5px/1 ${FONT}`,
                  color: 'var(--ink)',
                }}
              >
                Recent closings
              </div>
              {rows.length === 0 ? (
                <div
                  style={{
                    padding: '46px 20px',
                    textAlign: 'center',
                    font: `400 12.5px/1.5 ${FONT}`,
                    color: 'var(--ink-3)',
                  }}
                >
                  No day has been closed yet. Lock today to start the ledger.
                </div>
              ) : (
                rows.slice(0, 10).map((r) => (
                  <div
                    key={r.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 11,
                      padding: '11px 15px',
                      borderBottom: '1px solid var(--line)',
                    }}
                  >
                    <span
                      style={{ font: `500 12px/1 ${MONO}`, color: 'var(--ink-3)', width: 74 }}
                    >
                      {new Date(r.closingDate).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                      })}
                    </span>
                    <span
                      style={{ flex: 1, font: `500 12.5px/1 ${FONT}`, color: 'var(--ink-2)' }}
                    >
                      {r.totalOrders} orders · closed by {r.closedBy ?? 'system'}
                    </span>
                    <span style={{ font: `600 12.5px/1 ${MONO}`, color: 'var(--ink)' }}>
                      {formatTaka(Number(r.netProfit))}
                    </span>
                    <StatusChip status={r.status} />
                  </div>
                ))
              )}
            </div>
          </div>

          <div
            style={{
              flex: '1 1 28%',
              minWidth: 290,
              maxWidth: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div
              style={{
                ...card,
                padding: '15px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <span style={{ font: `600 13.5px/1 ${FONT}`, color: 'var(--ink)' }}>
                Cash reconciliation
              </span>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span
                  style={{
                    font: `600 11px/1 ${FONT}`,
                    letterSpacing: '.07em',
                    textTransform: 'uppercase',
                    color: 'var(--ink-3)',
                  }}
                >
                  Counted in drawer
                </span>
                <input
                  value={counted}
                  onChange={(e) => setCounted(e.target.value)}
                  inputMode="numeric"
                  placeholder="৳0"
                  style={{
                    height: 40,
                    padding: '0 12px',
                    borderRadius: 9,
                    border: '1px solid var(--line)',
                    background: 'var(--surface-2)',
                    outline: 'none',
                    color: 'var(--ink)',
                    font: `600 14px/1 ${MONO}`,
                  }}
                />
              </label>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ flex: 1, font: `500 12px/1 ${FONT}`, color: 'var(--ink-3)' }}>
                  System expects
                </span>
                <span style={{ font: `600 12.5px/1 ${MONO}`, color: 'var(--ink-2)' }}>
                  {formatTaka(expected)}
                </span>
              </div>

              {variance !== null && variance !== 0 ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 9,
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: `1px solid ${variance < 0 ? 'var(--bad-bd)' : 'var(--warn-bd)'}`,
                    background: variance < 0 ? 'var(--bad-soft)' : 'var(--warn-soft)',
                  }}
                >
                  <DcIcon
                    name="icon-triangle-alert"
                    size={14}
                    color={variance < 0 ? 'var(--bad)' : 'var(--warn)'}
                  />
                  <span style={{ flex: 1, font: `500 12px/1 ${FONT}`, color: 'var(--ink-2)' }}>
                    {variance < 0 ? 'Short by' : 'Over by'}
                  </span>
                  <span
                    style={{
                      font: `700 13px/1 ${MONO}`,
                      color: variance < 0 ? 'var(--bad)' : 'var(--warn)',
                    }}
                  >
                    {formatTaka(Math.abs(variance))}
                  </span>
                </div>
              ) : null}

              <textarea
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason for variance…"
                style={{
                  padding: '10px 12px',
                  borderRadius: 9,
                  border: '1px solid var(--line)',
                  background: 'var(--surface-2)',
                  outline: 'none',
                  resize: 'vertical',
                  color: 'var(--ink)',
                  font: `400 12.5px/1.5 ${FONT}`,
                }}
              />
            </div>

            <button
              type="button"
              disabled={locking || dayLocked}
              onClick={() => setConfirmLock(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                height: 42,
                borderRadius: 11,
                border: `1px solid ${dayLocked ? 'var(--line)' : 'var(--violet-solid)'}`,
                background: dayLocked ? 'var(--surface-2)' : 'var(--violet-solid)',
                color: dayLocked ? 'var(--ink-3)' : 'var(--on-violet)',
                cursor: locking || dayLocked ? 'not-allowed' : 'pointer',
                font: `600 13px/1 ${FONT}`,
                opacity: locking ? 0.7 : 1,
              }}
            >
              <DcIcon name={dayLocked ? 'icon-check' : 'icon-lock'} size={15} />
              <span>{dayLocked ? 'Day already locked' : locking ? 'Locking…' : 'Lock the day'}</span>
            </button>

            <span
              style={{
                font: `400 11.5px/1.5 ${FONT}`,
                color: 'var(--ink-3)',
                textWrap: 'pretty',
              }}
            >
              Locking freezes today&rsquo;s ledger on the server. It cannot be unlocked from this
              screen.
            </span>
          </div>
        </div>
      )}

      <DcModal
        open={confirmLock}
        title="Freeze today's ledger?"
        subtitle="Creates or locks today's daily closing record on the server. This cannot be unlocked from this screen."
        confirmLabel="Lock the day"
        danger
        busy={locking}
        onClose={() => !locking && setConfirmLock(false)}
        onConfirm={() => void lock()}
      />
    </>
  )
}

function StatusChip({ status }: { status: string }) {
  const tone = toneStyle(STATUS_TONE[status.toUpperCase()] ?? 'mute')
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '3px 8px',
        borderRadius: 6,
        font: `600 10.5px/1 ${FONT}`,
        letterSpacing: '.05em',
        border: `1px solid ${tone.bd}`,
        background: tone.bg,
        color: tone.fg,
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: 99, background: 'currentColor' }} />
      {status.toUpperCase()}
    </span>
  )
}

function MoneyRow({
  icon,
  color,
  label,
  sub,
  amount,
}: {
  icon: string
  color: string
  label: string
  sub: string
  amount: string
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 11,
        padding: '11px 0',
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
          color,
        }}
      >
        <DcIcon name={icon} size={13} />
      </span>
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ font: `500 12.5px/1.3 ${FONT}`, color: 'var(--ink)' }}>{label}</span>
        <span style={{ font: `400 11.5px/1.35 ${FONT}`, color: 'var(--ink-3)' }}>{sub}</span>
      </span>
      <span style={{ font: `600 13px/1 ${MONO}`, color: 'var(--ink)', whiteSpace: 'nowrap' }}>
        {amount}
      </span>
    </div>
  )
}
