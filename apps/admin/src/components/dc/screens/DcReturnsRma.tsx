'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

import { DcIcon } from '@/components/dc/DcIcon'
import { DcPageHead } from '@/components/dc/DcPageHead'
import { DcScreenProvider, useDcScreen } from '@/components/dc/DcScreenContext'
import { DcEmptyState, DcErrorState, DcLoadingState } from '@/components/dc/blocks/DcStates'
import { DcField, DcModal } from '@/components/dc/DcModal'
import { DcCard } from '@/components/dc/primitives/DcCard'
import { DcTable } from '@/components/dc/primitives/DcTable'
import type { DcBlock } from '@/components/dc/blocks/types'
import { dcPageStatus } from '@/components/dc/page-status'
import { FONT, MONO, formatCount, formatTaka, toneStyle, type DcTone } from '@/components/dc/tokens'
import type { ApiRmaRow, RmaApiStatus } from '@/lib/api/commerce-finance'
import { useCreateReturn, useOrders, useReturns, useUpdateReturnStatus } from '@/lib/api/hooks'
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

const RMA_TONE: Record<ApiRmaRow['status'], DcTone> = {
  pending: 'warn',
  approved: 'info',
  received: 'vio',
  refunded: 'ok',
  rejected: 'bad',
}

/**
 * What the operator is actually deciding at each stage. The list rows are
 * lowercase display statuses from the API; the PATCH body takes the uppercase
 * `RmaApiStatus` enum, so the mapping lives here in one place.
 */
const NEXT_MOVE: Partial<
  Record<
    ApiRmaRow['status'],
    { primary: { label: string; status: RmaApiStatus }; reject?: { label: string; status: RmaApiStatus }; why: string }
  >
> = {
  pending: {
    primary: { label: 'Approve return', status: 'APPROVED' },
    reject: { label: 'Reject', status: 'REJECTED' },
    why: 'The customer is waiting on a yes or no. Approving tells them to ship the item back.',
  },
  approved: {
    primary: { label: 'Item received', status: 'ITEM_RECEIVED' },
    why: 'Approved but nothing back on the shelf yet. Mark received only when you have the item in hand.',
  },
  received: {
    primary: { label: 'Refund', status: 'REFUNDED' },
    why: 'Item is back. Money still with you — refund closes the loop and hits the day’s cash.',
  },
}

const OPEN_STATUSES: ApiRmaRow['status'][] = ['pending', 'approved', 'received']

/** One column per stage a return can sit in, in the order it moves through them. */
const STAGES: Array<{ label: string; status: ApiRmaRow['status']; dot: string; why: string }> = [
  { label: 'Requested', status: 'pending', dot: 'var(--warn)', why: 'waiting on your yes or no' },
  { label: 'Approved', status: 'approved', dot: 'var(--info)', why: 'customer is shipping it back' },
  { label: 'Received', status: 'received', dot: 'var(--violet-solid)', why: 'item in hand, money not returned' },
  { label: 'Refunded', status: 'refunded', dot: 'var(--ok)', why: 'closed, money out' },
  { label: 'Rejected', status: 'rejected', dot: 'var(--bad)', why: 'turned down' },
]

const REASONS = [
  'Wrong size',
  'Damaged on arrival',
  'Not as described',
  'Changed mind',
  'Wrong item shipped',
  'Quality issue',
]

interface PendingMove {
  row: ApiRmaRow
  status: RmaApiStatus
  label: string
}

export function DcReturnsRma() {
  const router = useRouter()
  return (
    <DcScreenProvider screen="returns" onNavigate={(next) => router.push(`/dashboard/${next}`)}>
      <DcReturnsRmaBody />
    </DcScreenProvider>
  )
}

function DcReturnsRmaBody() {
  const { toast } = useDcScreen()
  const [search, setSearch] = useState('')
  const returns = useReturns(search.trim() || undefined)
  const updateStatus = useUpdateReturnStatus()
  const createReturn = useCreateReturn()
  const { api } = useAdminConnection(25_000)

  const [move, setMove] = useState<PendingMove | null>(null)
  const [refundAmount, setRefundAmount] = useState('')
  const [note, setNote] = useState('')
  const [newOpen, setNewOpen] = useState(false)
  const [orderQuery, setOrderQuery] = useState('')
  const [form, setForm] = useState<{
    orderId: string
    reason: string
    description: string
    type: 'RETURN' | 'EXCHANGE' | 'REPAIR'
  }>({ orderId: '', reason: REASONS[0] ?? '', description: '', type: 'RETURN' })

  const orderPicker = useOrders(
    newOpen ? { limit: 20, ...(orderQuery.trim() ? { search: orderQuery.trim() } : {}) } : undefined,
  )

  const [stageFilter, setStageFilter] = useState<string>('ALL')
  const rows = useMemo(() => returns.data ?? [], [returns.data])
  const filteredRows = useMemo(() => {
    if (stageFilter === 'ALL') return rows
    return rows.filter((r) => r.status.toLowerCase() === stageFilter.toLowerCase())
  }, [rows, stageFilter])
  const open = useMemo(() => rows.filter((r) => OPEN_STATUSES.includes(r.status)), [rows])
  const needsDecision = useMemo(() => rows.filter((r) => NEXT_MOVE[r.status]), [rows])

  const exposure = open.reduce((s, r) => s + Number(r.amount || 0), 0)
  const refunded = rows
    .filter((r) => r.status === 'refunded')
    .reduce((s, r) => s + Number(r.amount || 0), 0)
  const rejected = rows.filter((r) => r.status === 'rejected').length
  // The stage strip above already prints the rejected count, so the KPI carries
  // the share instead of repeating the same number two rows apart.
  const rejectionRate = rows.length > 0 ? (rejected / rows.length) * 100 : null

  const pageStatus = dcPageStatus([returns], api.pulse)

  const skeleton: DcBlock[] = [
    { t: 'kpis' } as DcBlock,
    { t: 'decide', title: '', items: [] } as DcBlock,
    { t: 'table', w: 'full', title: '', cols: [], rows: [] } as DcBlock,
  ]

  const openMove = (row: ApiRmaRow, status: RmaApiStatus, label: string) => {
    setRefundAmount(status === 'REFUNDED' ? String(Math.round(Number(row.amount || 0))) : '')
    setNote('')
    setMove({ row, status, label })
  }

  const runMove = () => {
    if (!move) return
    const amount = Number(refundAmount)
    if (move.status === 'REFUNDED' && (!Number.isFinite(amount) || amount <= 0)) {
      toast('warn', 'Refund amount required', 'A refund of 0 is rejected — enter what the customer gets back.')
      return
    }
    updateStatus.mutate(
      {
        id: move.row.id,
        status: move.status,
        ...(note.trim() ? { note: note.trim() } : {}),
        ...(move.status === 'REFUNDED' ? { refundAmount: amount } : {}),
      },
      {
        onSuccess: (res) => {
          const label = move.label
          setMove(null)
          toast('ok', `${res.rmaNumber} → ${res.status}`, `${label} recorded against the return.`)
        },
        onError: (err) => {
          setMove(null)
          toast(
            'bad',
            'Could not update the return',
            err instanceof Error
              ? err.message
              : `PATCH /admin/commerce-finance/returns/${move.row.id}/status failed`,
          )
        },
      },
    )
  }

  const exportCsv = () => {
    if (rows.length === 0) {
      toastWarn('No return records to export')
      return
    }
    const headers = ['RMA', 'Order', 'Customer', 'Reason', 'Items', 'Amount', 'Method', 'Status', 'Updated']
    const csvRows = [
      headers,
      ...rows.map((r) => [
        r.rmaNumber,
        r.orderNumber,
        r.customer,
        r.reason,
        r.items,
        String(r.amount || 0),
        r.method,
        r.status,
        r.updated,
      ]),
    ]
    downloadCsv(`splaro-rma-returns-${new Date().toISOString().slice(0, 10)}.csv`, csvRows)
    toastOk(`Exported ${rows.length} return records`)
  }

  return (
    <>
      <DcPageHead
        crumbGroup="Operations"
        title="Returns / RMA"
        statusLabel={pageStatus.label}
        statusTone={pageStatus.tone}
        syncLabel={
          returns.isFetching
            ? 'syncing…'
            : `${rows.length} return${rows.length === 1 ? '' : 's'} · ${open.length} open`
        }
        syncing={returns.isFetching}
        onSync={() => void returns.refetch()}
        actions={[
          {
            label: 'New return',
            icon: 'icon-plus',
            variant: 'primary',
            onClick: () => {
              setForm({ orderId: '', reason: REASONS[0] ?? '', description: '', type: 'RETURN' })
              setOrderQuery('')
              setNewOpen(true)
            },
          },
          {
            label: 'Export CSV',
            icon: 'icon-download',
            onClick: exportCsv,
          },
        ]}
      />

      <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', alignItems: 'center' }}>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flex: '1 1 260px',
            minWidth: 0,
            height: 36,
            padding: '0 12px',
            borderRadius: 10,
            border: '1px solid var(--line)',
            background: 'var(--surface)',
          }}
        >
          <DcIcon name="icon-search" size={14} color="var(--ink-3)" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="RMA number, order number or customer"
            style={{
              flex: 1,
              minWidth: 0,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              color: 'var(--ink)',
              font: `400 12.5px/1 ${FONT}`,
            }}
          />
        </label>
      </div>

      {returns.isLoading ? (
        <DcLoadingState blocks={skeleton} />
      ) : returns.error ? (
        <DcErrorState
          error={`GET /admin/commerce-finance/returns → ${returns.error instanceof Error ? returns.error.message : '500 Internal Server Error'}`}
          hint="Return records are untouched — only this list failed to load."
          onRetry={() => void returns.refetch()}
        />
      ) : rows.length === 0 ? (
        <DcEmptyState
          icon="icon-rotate-ccw"
          title={search.trim() ? 'No returns match that search' : 'No returns yet'}
          body={
            search.trim()
              ? 'Try the RMA number, the order number, or the customer name.'
              : 'A return files against an existing order. Nothing has been sent back so far.'
          }
          {...(search.trim() ? {} : { cta: 'File a return', onCta: () => setNewOpen(true) })}
        />
      ) : (
        <>
          {/* Stage strip — every return in the window, by where it is stuck. */}
          <div
            style={{
              ...card,
              display: 'flex',
              flexWrap: 'wrap',
              gap: 1,
              overflow: 'hidden',
              background: 'var(--line)',
            }}
          >
            {STAGES.map((st) => {
              const count = rows.filter((r) => r.status === st.status).length
              return (
                <div
                  key={st.status}
                  style={{
                    flex: '1 1 150px',
                    minWidth: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    padding: '13px 15px',
                    background: 'var(--surface)',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        flex: 'none',
                        borderRadius: 99,
                        background: st.dot,
                      }}
                    />
                    <span
                      style={{
                        font: `600 11px/1 ${FONT}`,
                        letterSpacing: '.06em',
                        textTransform: 'uppercase',
                        color: 'var(--ink-3)',
                      }}
                    >
                      {st.label}
                    </span>
                  </span>
                  <span style={{ font: `700 21px/1 ${FONT}`, color: 'var(--ink)' }}>{count}</span>
                  <span style={{ font: `400 11px/1.35 ${FONT}`, color: 'var(--ink-3)' }}>
                    {st.why}
                  </span>
                </div>
              )
            })}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(206px, 1fr))',
              gap: 12,
            }}
          >
            <Kpi label="Open returns" value={formatCount(open.length)} sub="not yet refunded or rejected" />
            <Kpi
              label="Refund exposure"
              value={formatTaka(exposure)}
              sub="money you may owe back"
              color={exposure > 0 ? 'var(--warn)' : 'var(--ink)'}
            />
            <Kpi
              label="Refunded to date"
              value={formatTaka(refunded)}
              sub="money already paid back"
              color="var(--ok)"
            />
            <Kpi
              label="Rejection rate"
              value={rejectionRate === null ? '—' : `${rejectionRate.toFixed(0)}%`}
              sub={`${formatCount(rejected)} of ${formatCount(rows.length)} turned down`}
            />
          </div>

          {needsDecision.length > 0 ? (
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
                  Returns waiting on you
                </span>
                <span
                  style={{
                    flex: 1,
                    minWidth: 60,
                    font: `400 11.5px/1.4 ${FONT}`,
                    color: 'var(--ink-3)',
                  }}
                >
                  every hour here is a customer refreshing their phone
                </span>
              </div>
              <div
                style={{
                  padding: 12,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(min(330px, 100%), 1fr))',
                  gap: 10,
                }}
              >
                {needsDecision.slice(0, 9).map((r) => {
                  const next = NEXT_MOVE[r.status]
                  if (!next) return null
                  const tone = toneStyle(RMA_TONE[r.status])
                  return (
                    <div
                      key={r.id}
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
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                        <span
                          style={{
                            flex: 1,
                            minWidth: 0,
                            font: `600 13px/1.35 ${FONT}`,
                            color: 'var(--ink)',
                          }}
                        >
                          {r.customer}
                        </span>
                        <span
                          style={{ flex: 'none', font: `400 10.5px/1.5 ${MONO}`, color: 'var(--ink-3)' }}
                        >
                          {r.rmaNumber}
                        </span>
                      </div>
                      <span
                        style={{
                          alignSelf: 'flex-start',
                          padding: '3px 8px',
                          borderRadius: 6,
                          border: `1px solid ${tone.bd}`,
                          background: tone.bg,
                          color: tone.fg,
                          font: `700 9.5px/1.3 ${FONT}`,
                          letterSpacing: '.07em',
                          textTransform: 'uppercase',
                        }}
                      >
                        {r.status} · {r.method}
                      </span>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'baseline',
                          gap: 7,
                          flexWrap: 'wrap',
                          padding: '9px 10px',
                          border: '1px solid var(--line)',
                          borderRadius: 9,
                          background: 'var(--surface)',
                        }}
                      >
                        <span style={{ font: `700 14.5px/1.3 ${MONO}`, color: 'var(--ink)' }}>
                          {formatTaka(Number(r.amount || 0))}
                        </span>
                        <span style={{ font: `500 11px/1.4 ${FONT}`, color: 'var(--ink-3)' }}>
                          on {r.orderNumber} · {r.items}
                        </span>
                      </div>
                      <span
                        style={{
                          font: `400 11.5px/1.55 ${FONT}`,
                          color: 'var(--ink-3)',
                          textWrap: 'pretty',
                        }}
                      >
                        {r.reason} — {next.why}
                      </span>
                      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', paddingTop: 2 }}>
                        <button
                          type="button"
                          disabled={updateStatus.isPending}
                          onClick={() => openMove(r, next.primary.status, next.primary.label)}
                          style={{
                            height: 30,
                            padding: '0 12px',
                            borderRadius: 8,
                            border: '1px solid var(--violet-solid)',
                            background: 'var(--violet-solid)',
                            color: 'var(--on-violet)',
                            cursor: updateStatus.isPending ? 'not-allowed' : 'pointer',
                            font: `600 11.5px/1 ${FONT}`,
                          }}
                        >
                          {next.primary.label}
                        </button>
                        {next.reject ? (
                          <button
                            type="button"
                            disabled={updateStatus.isPending}
                            onClick={() => openMove(r, next.reject!.status, next.reject!.label)}
                            style={{
                              height: 30,
                              padding: '0 12px',
                              borderRadius: 8,
                              border: '1px solid var(--line-2)',
                              background: 'transparent',
                              color: 'var(--ink-2)',
                              cursor: updateStatus.isPending ? 'not-allowed' : 'pointer',
                              font: `600 11.5px/1 ${FONT}`,
                            }}
                          >
                            {next.reject.label}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : null}

          <DcCard clip>
            <div className="dc-card__head" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                {['ALL', 'PENDING', 'APPROVED', 'RECEIVED', 'REFUNDED', 'REJECTED'].map((st) => {
                  const active = stageFilter === st
                  return (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setStageFilter(st)}
                      style={{
                        padding: '6px 10px',
                        borderRadius: 7,
                        border: `1px solid ${active ? 'var(--violet-bd)' : 'var(--line)'}`,
                        background: active ? 'var(--violet-soft)' : 'var(--surface-2)',
                        color: active ? 'var(--violet)' : 'var(--ink-2)',
                        font: `600 11px/1 ${FONT}`,
                        cursor: 'pointer',
                      }}
                    >
                      {st === 'PENDING' ? 'REQUESTED' : st}
                    </button>
                  )
                })}
              </div>
              <span className="dc-card__meta">
                {filteredRows.length} record{filteredRows.length === 1 ? '' : 's'}
              </span>
            </div>
            <DcTable minWidth={980} sticky>
              <thead>
                <tr>
                  <th>RMA</th>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Reason</th>
                  <th>Items</th>
                  <th className="is-num">Amount</th>
                  <th>Method</th>
                  <th>Status</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((r) => {
                  const tone = toneStyle(RMA_TONE[r.status])
                  return (
                    <tr key={r.id}>
                      <td className="is-mono" style={{ fontWeight: 600 }}>
                        {r.rmaNumber}
                      </td>
                      <td className="is-mono">{r.orderNumber}</td>
                      <td>{r.customer}</td>
                      <td>{r.reason}</td>
                      <td style={{ color: 'var(--ink-3)' }}>{r.items}</td>
                      <td className="is-num" style={{ fontWeight: 600 }}>
                        {formatTaka(Number(r.amount || 0))}
                      </td>
                      <td>{r.method}</td>
                      <td>
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
                            style={{ width: 5, height: 5, borderRadius: 99, background: 'currentColor' }}
                          />
                          {r.status}
                        </span>
                      </td>
                      <td style={{ color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>{r.updated}</td>
                    </tr>
                  )
                })}
              </tbody>
            </DcTable>
          </DcCard>
        </>
      )}

      {/* ── confirm a status move ────────────────────────────────── */}
      <DcModal
        open={move !== null}
        title={move ? `${move.label} — ${move.row.rmaNumber}?` : 'Update return'}
        subtitle={
          move?.status === 'REFUNDED'
            ? 'A refund moves real money and lands in the day’s closing. It cannot be undone here.'
            : move?.status === 'REJECTED'
              ? 'Rejecting tells the customer no. Leave a note so support can explain it.'
              : 'This changes what the customer sees on their return.'
        }
        confirmLabel={move?.label ?? 'Confirm'}
        danger={move?.status === 'REJECTED'}
        busy={updateStatus.isPending}
        onClose={() => setMove(null)}
        onConfirm={runMove}
      >
        {move?.status === 'REFUNDED' ? (
          <DcField
            label="Refund amount (৳)"
            value={refundAmount}
            onChange={setRefundAmount}
            mono
            hint={`Return is worth ${formatTaka(Number(move.row.amount || 0))}. Refund less if you keep a restocking cut.`}
          />
        ) : null}
        <DcField label="Note" value={note} onChange={setNote} area />
      </DcModal>

      {/* ── file a new return ────────────────────────────────────── */}
      <DcModal
        open={newOpen}
        title="File a return"
        subtitle="A return always attaches to an existing order — find the order first."
        confirmLabel="File return"
        busy={createReturn.isPending}
        onClose={() => setNewOpen(false)}
        onConfirm={() => {
          if (!form.orderId) {
            toast('warn', 'Pick the order', 'A return cannot exist without the order it came from.')
            return
          }
          if (!form.reason.trim()) {
            toast('warn', 'Reason required', 'The reason drives what the customer is told next.')
            return
          }
          createReturn.mutate(
            {
              orderId: form.orderId,
              reason: form.reason.trim(),
              type: form.type,
              ...(form.description.trim() ? { description: form.description.trim() } : {}),
            },
            {
              onSuccess: (res) => {
                setNewOpen(false)
                toast(
                  'ok',
                  `${res.rmaNumber} filed`,
                  `Against ${res.orderNumber}. It is now waiting on your approval.`,
                )
              },
              onError: (err) =>
                toast(
                  'bad',
                  'Could not file the return',
                  err instanceof Error
                    ? err.message
                    : 'POST /admin/commerce-finance/returns failed',
                ),
            },
          )
        }}
      >
        <DcField
          label="Find the order"
          value={orderQuery}
          onChange={setOrderQuery}
          placeholder="Invoice number, phone or name"
        />
        <div
          style={{
            maxHeight: 176,
            overflow: 'auto',
            border: '1px solid var(--line)',
            borderRadius: 10,
            background: 'var(--surface-2)',
          }}
        >
          {orderPicker.isLoading ? (
            <Note text="Loading orders…" />
          ) : orderPicker.error ? (
            <Note
              text={`GET /admin/orders → ${orderPicker.error instanceof Error ? orderPicker.error.message : 'request failed'}`}
            />
          ) : (orderPicker.data?.orders ?? []).length === 0 ? (
            <Note text="No orders match that search." />
          ) : (
            (orderPicker.data?.orders ?? []).map((o) => {
              const picked = form.orderId === o.id
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, orderId: o.id }))}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    width: '100%',
                    padding: '9px 12px',
                    border: 'none',
                    borderBottom: '1px solid var(--line)',
                    background: picked ? 'var(--violet-soft)' : 'transparent',
                    color: 'var(--ink)',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ font: `600 12px/1 ${MONO}`, color: 'var(--ink)' }}>
                    {o.invoiceNumber}
                  </span>
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      font: `400 12px/1.3 ${FONT}`,
                      color: 'var(--ink-2)',
                    }}
                  >
                    {o.shippingName} · {o.status}
                  </span>
                  <span style={{ font: `600 12px/1 ${MONO}`, color: 'var(--ink)' }}>
                    {formatTaka(Number(o.total || 0))}
                  </span>
                  {picked ? <DcIcon name="icon-check" size={13} color="var(--violet-ink)" /> : null}
                </button>
              )
            })
          )}
        </div>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span
            style={{
              font: `600 11px/1 ${FONT}`,
              letterSpacing: '.07em',
              textTransform: 'uppercase',
              color: 'var(--ink-3)',
            }}
          >
            Reason
          </span>
          <select
            value={form.reason}
            onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
            style={selectStyle}
          >
            {REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span
            style={{
              font: `600 11px/1 ${FONT}`,
              letterSpacing: '.07em',
              textTransform: 'uppercase',
              color: 'var(--ink-3)',
            }}
          >
            Type
          </span>
          <select
            value={form.type}
            onChange={(e) =>
              setForm((f) => ({ ...f, type: e.target.value as 'RETURN' | 'EXCHANGE' | 'REPAIR' }))
            }
            style={selectStyle}
          >
            <option value="RETURN">Return — money back</option>
            <option value="EXCHANGE">Exchange — different size or item</option>
            <option value="REPAIR">Repair — fix and send back</option>
          </select>
        </label>

        <DcField
          label="Description"
          value={form.description}
          onChange={(v) => setForm((f) => ({ ...f, description: v }))}
          area
        />
      </DcModal>
    </>
  )
}

const selectStyle = {
  height: 40,
  padding: '0 10px',
  borderRadius: 9,
  border: '1px solid var(--line)',
  background: 'var(--surface-2)',
  color: 'var(--ink)',
  font: `400 12.5px/1 ${FONT}`,
  outline: 'none',
} as const

function Note({ text }: { text: string }) {
  return (
    <div
      style={{
        padding: '26px 14px',
        textAlign: 'center',
        font: `400 12px/1.55 ${FONT}`,
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
  color?: string
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
