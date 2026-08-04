'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

import { DcIcon } from '@/components/dc/DcIcon'
import { DcPageHead } from '@/components/dc/DcPageHead'
import { DcScreenProvider, useDcScreen } from '@/components/dc/DcScreenContext'
import { DcEmptyState, DcErrorState, DcLoadingState } from '@/components/dc/blocks/DcStates'
import type { DcBlock } from '@/components/dc/blocks/types'
import { FONT, MONO, toneStyle, type DcTone } from '@/components/dc/tokens'
import { useCourierShipments, useCourierStats } from '@/lib/api/hooks'
import { bookCourierShipment, retryCourierShipment, type CourierShipmentRow } from '@/lib/api/courier'
import { toastCourierResult } from '@/lib/admin/feedback'
import { isDevCourierConsignment, isLiveCourierConsignment } from '@/lib/admin/courier-save'
import { DcModal } from '@/components/dc/DcModal'
import { dcPageStatus } from '@/components/dc/page-status'
import { useAdminConnection } from '@/lib/hooks/use-admin-connection'

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

/** Courier shipment status → chip tone. */
const STATE_TONE: Record<string, DcTone> = {
  PENDING: 'warn',
  QUEUED: 'warn',
  BOOKED: 'info',
  IN_TRANSIT: 'info',
  DELIVERED: 'ok',
  FAILED: 'bad',
  CANCELLED: 'bad',
  RETURNED: 'bad',
}

function label(status: string) {
  return status.replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase())
}

export function DcCourierHub() {
  const router = useRouter()
  return (
    <DcScreenProvider screen="courier" onNavigate={(next) => router.push(`/dashboard/${next}`)}>
      <DcCourierBody />
    </DcScreenProvider>
  )
}

function DcCourierBody() {
  const router = useRouter()
  const { toast } = useDcScreen()
  const qc = useQueryClient()
  // Booking hands a real parcel to a courier, so it is always confirmed first.
  const [confirmBook, setConfirmBook] = useState<{ orderId: string; invoice: string } | null>(null)
  const [confirmRetry, setConfirmRetry] = useState<{ orderId: string; invoice: string } | null>(
    null,
  )

  const shipments = useCourierShipments({ limit: 60 })
  const stats = useCourierStats(30)
  const { api } = useAdminConnection(25_000)

  const rows = useMemo(() => shipments.data?.items ?? [], [shipments.data])
  const byStatus = useMemo(() => {
    const m: Record<string, number> = {}
    for (const s of stats.data?.byStatus ?? []) m[s.status.toUpperCase()] = s._count
    return m
  }, [stats.data])

  const queued = (byStatus['PENDING'] ?? 0) + (byStatus['QUEUED'] ?? 0)
  const inTransit = byStatus['IN_TRANSIT'] ?? 0
  const delivered = byStatus['DELIVERED'] ?? 0
  const failed = (byStatus['FAILED'] ?? 0) + (byStatus['CANCELLED'] ?? 0)
  const recentFailed = stats.data?.recentFailed ?? []

  const book = useMutation({
    mutationFn: (orderId: string) => bookCourierShipment(orderId),
    onSuccess: (res, orderId) => {
      void shipments.refetch()
      void stats.refetch()
      void qc.invalidateQueries({ queryKey: ['orders'] })
      setConfirmBook(null)
      const label = confirmBook?.invoice ?? orderId
      toastCourierResult(
        {
          success: Boolean(res.consignmentId),
          ...(res.consignmentId ? { consignmentId: res.consignmentId } : {}),
          ...(res.simulated ? { simulated: true } : {}),
        },
        label,
      )
    },
    onError: (err) => {
      setConfirmBook(null)
      toast(
        'bad',
        'Booking failed',
        err instanceof Error ? err.message : 'POST /admin/courier/:orderId/book failed',
      )
    },
  })

  const retry = useMutation({
    mutationFn: (orderId: string) => retryCourierShipment(orderId),
    onSuccess: (res, orderId) => {
      void shipments.refetch()
      void stats.refetch()
      setConfirmRetry(null)
      const label = confirmRetry?.invoice ?? orderId
      toastCourierResult(
        {
          success: Boolean(res.consignmentId),
          ...(res.consignmentId ? { consignmentId: res.consignmentId } : {}),
        },
        label,
      )
    },
    onError: (err) => {
      setConfirmRetry(null)
      toast(
        'bad',
        'Retry failed',
        err instanceof Error ? err.message : 'POST /admin/courier/:orderId/retry failed',
      )
    },
  })

  const skeleton: DcBlock[] = [
    { t: 'banner', tone: 'info', icon: 'icon-info', text: '' },
    { t: 'kpis', items: [] },
    { t: 'table', w: 'main', title: '', cols: [], rows: [] },
    { t: 'list', w: 'side', title: '', items: [] },
  ]

  const pageStatus = dcPageStatus([shipments, stats], api.pulse)

  return (
    <>
      <DcPageHead
        crumbGroup="Operations"
        title="Courier Hub"
        statusLabel={pageStatus.label}
        statusTone={pageStatus.tone}
        syncLabel={shipments.isFetching ? 'syncing…' : `${shipments.data?.total ?? 0} shipments`}
        syncing={shipments.isFetching}
        onSync={() => {
          void shipments.refetch()
          void stats.refetch()
        }}
        actions={[
          {
            label: 'Sync statuses',
            icon: 'icon-refresh-cw',
            onClick: () => {
              void shipments.refetch()
              void stats.refetch()
              toast('info', 'Refreshing shipments', 'Pulls the latest rows from the courier API cache.')
            },
          },
          {
            label: 'Book queue',
            icon: 'icon-truck',
            variant: 'primary',
            onClick: () =>
              toast(
                'info',
                `${queued} parcels queued`,
                'Bulk booking runs from the Orders screen — select the packed parcels there.',
              ),
          },
        ]}
      />

      {shipments.isLoading ? (
        <DcLoadingState blocks={skeleton} />
      ) : shipments.error ? (
        <DcErrorState
          error={`GET /admin/courier/shipments → ${shipments.error instanceof Error ? shipments.error.message : '500 Internal Server Error'}`}
          hint="Parcels already handed over are unaffected — only this view failed to load."
          onRetry={() => {
            void shipments.refetch()
          }}
        />
      ) : rows.length === 0 ? (
        <DcEmptyState
          icon="icon-truck"
          title="Nothing booked yet"
          body="A shipment row appears the moment a packed order is handed to a courier. Book from Orders or the Packing Station."
          cta="Open Orders"
          onCta={() => router.push('/dashboard/orders')}
        />
      ) : (
        <>
          <MobileCourierList
            rows={rows}
            onOpenOrder={(invoice) => router.push(`/dashboard/orders/${invoice}`)}
            onBook={(orderId, invoice) => setConfirmBook({ orderId, invoice })}
            onRetry={(orderId, invoice) => setConfirmRetry({ orderId, invoice })}
          />

          <div className="dc-desktop-route-panel">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 11,
              padding: '11px 14px',
              borderRadius: 11,
              border: '1px solid var(--info-bd)',
              background: 'var(--info-soft)',
            }}
          >
            <DcIcon name="icon-info" size={15} color="var(--info)" />
            <span
              style={{
                flex: 1,
                font: `500 12.5px/1.5 ${FONT}`,
                color: 'var(--ink-2)',
                textWrap: 'pretty',
              }}
            >
              A parcel only reads <strong style={{ color: 'var(--ink)' }}>Booked</strong> once the
              courier returns a consignment ID. Until then it stays{' '}
              <strong style={{ color: 'var(--ink)' }}>Queued</strong> — no optimistic status.
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(196px, 1fr))',
              gap: 12,
            }}
          >
            <Kpi label="Queued" value={String(queued)} sub="waiting on a consignment ID" color={queued > 0 ? 'var(--warn)' : 'var(--ink)'} />
            <Kpi label="In transit" value={String(inTransit)} sub="with the courier now" />
            <Kpi label="Delivered · 30d" value={String(delivered)} sub="closed successfully" color="var(--ok)" />
            <Kpi label="Failed · 30d" value={String(failed)} sub="need a decision" color={failed > 0 ? 'var(--bad)' : 'var(--ink)'} />
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
              <div style={{ ...card, overflow: 'auto' }}>
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
                    Booking queue
                  </span>
                  <span style={{ font: `500 11.5px/1 ${FONT}`, color: 'var(--ink-3)' }}>
                    {rows.length} shown
                  </span>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', minWidth: 900, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={th}>Order</th>
                      <th style={th}>Recipient</th>
                      <th style={th}>Provider</th>
                      <th style={th}>Consignment</th>
                      <th style={th}>State</th>
                      <th style={{ ...th, textAlign: 'right' }}>&nbsp;</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const tone = toneStyle(STATE_TONE[r.status.toUpperCase()] ?? 'mute')
                      const booked = isLiveCourierConsignment(r.consignmentId, r.trackingCode)
                      const simulated = isDevCourierConsignment(r.consignmentId, r.trackingCode)
                      const hasFailed = ['FAILED', 'CANCELLED'].includes(r.status.toUpperCase())
                      const cnLabel = r.consignmentId ?? r.trackingCode ?? '—'
                      return (
                        <tr
                          key={r.id}
                          onClick={() => router.push(`/dashboard/orders/${r.orderId}`)}
                          className="dc-hover-surface"
                          style={{ borderBottom: '1px solid var(--line)', cursor: 'pointer' }}
                        >
                          <td style={{ padding: '11px 14px', font: `600 12.5px/1 ${MONO}`, color: 'var(--ink)' }}>
                            {r.order.invoiceNumber}
                          </td>
                          <td style={{ padding: '11px 14px', font: `500 13px/1 ${FONT}`, color: 'var(--ink-2)' }}>
                            {r.order.shippingName}
                          </td>
                          <td style={{ padding: '11px 14px', font: `500 12px/1 ${FONT}`, color: 'var(--ink-2)' }}>
                            {r.provider}
                          </td>
                          <td
                            style={{
                              padding: '11px 14px',
                              font: `500 12px/1 ${MONO}`,
                              color: booked ? 'var(--ink-2)' : simulated ? 'var(--warn)' : 'var(--ink-3)',
                            }}
                          >
                            {simulated ? `${cnLabel} · sim` : cnLabel}
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
                              {label(r.status)}
                            </span>
                          </td>
                          <td
                            style={{ padding: '11px 14px', textAlign: 'right' }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {booked ? (
                              <span style={{ font: `400 11.5px/1 ${FONT}`, color: 'var(--ink-3)' }}>
                                handed over
                              </span>
                            ) : hasFailed ? (
                              <button
                                type="button"
                                disabled={retry.isPending}
                                onClick={() =>
                                  setConfirmRetry({
                                    orderId: r.orderId,
                                    invoice: r.order.invoiceNumber,
                                  })
                                }
                                style={{
                                  height: 28,
                                  padding: '0 11px',
                                  borderRadius: 8,
                                  border: '1px solid var(--bad-bd)',
                                  background: 'var(--bad-soft)',
                                  color: 'var(--bad)',
                                  cursor: retry.isPending ? 'not-allowed' : 'pointer',
                                  font: `600 11.5px/1 ${FONT}`,
                                }}
                              >
                                Retry
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={book.isPending}
                                onClick={() =>
                                  setConfirmBook({
                                    orderId: r.orderId,
                                    invoice: r.order.invoiceNumber,
                                  })
                                }
                                style={{
                                  height: 28,
                                  padding: '0 11px',
                                  borderRadius: 8,
                                  border: '1px solid var(--violet-solid)',
                                  background: 'var(--violet-solid)',
                                  color: 'var(--on-violet)',
                                  cursor: book.isPending ? 'not-allowed' : 'pointer',
                                  font: `600 11.5px/1 ${FONT}`,
                                }}
                              >
                                Book
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  </table>
                </div>
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
              <div style={{ ...card, padding: '13px 15px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <span
                    style={{
                      display: 'grid',
                      placeItems: 'center',
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      border: '1px solid var(--line)',
                      background: 'var(--surface-2)',
                      color: 'var(--violet)',
                    }}
                  >
                    <DcIcon name="icon-truck" size={14} />
                  </span>
                  <span style={{ flex: 1, font: `600 13px/1 ${FONT}`, color: 'var(--ink)' }}>
                    Providers
                  </span>
                </div>
                {(stats.data?.byProvider ?? []).length === 0 ? (
                  <span style={{ font: `400 12px/1.5 ${FONT}`, color: 'var(--ink-3)' }}>
                    No provider has handled a parcel in the last 30 days.
                  </span>
                ) : (
                  (stats.data?.byProvider ?? []).map((p) => (
                    <div key={p.provider} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <span style={{ width: 7, height: 7, borderRadius: 99, background: 'var(--ok)' }} />
                      <span style={{ flex: 1, font: `500 12.5px/1 ${FONT}`, color: 'var(--ink-2)' }}>
                        {p.provider}
                      </span>
                      <span style={{ font: `600 12px/1 ${MONO}`, color: 'var(--ink)' }}>
                        {p._count}
                      </span>
                    </div>
                  ))
                )}
              </div>

              {recentFailed.length > 0 ? (
                <div
                  style={{
                    border: '1px solid var(--bad-bd)',
                    borderRadius: 14,
                    background: 'var(--bad-soft)',
                    padding: '13px 15px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <DcIcon name="icon-triangle-alert" size={13} color="var(--bad)" />
                    <span
                      style={{
                        flex: 1,
                        font: `700 10px/1 ${FONT}`,
                        letterSpacing: '.1em',
                        textTransform: 'uppercase',
                        color: 'var(--bad)',
                      }}
                    >
                      Booking failed · {recentFailed.length}
                    </span>
                  </span>
                  {recentFailed.slice(0, 4).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() =>
                        setConfirmRetry({
                          orderId: f.orderId,
                          invoice: f.order.invoiceNumber,
                        })
                      }
                      title="Retry this booking"
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                        padding: '9px 10px',
                        borderRadius: 9,
                        border: '1px solid var(--line)',
                        background: 'var(--surface)',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <span style={{ font: `600 12px/1 ${MONO}`, color: 'var(--ink)' }}>
                          {f.order.invoiceNumber}
                        </span>
                        <span style={{ font: `400 11.5px/1 ${FONT}`, color: 'var(--ink-3)' }}>
                          {f.order.shippingName}
                        </span>
                      </span>
                      {/* The provider's exact error, verbatim — never paraphrased. */}
                      <span style={{ font: `500 11px/1.45 ${MONO}`, color: 'var(--bad)' }}>
                        {f.provider} · {f.failureReason ?? 'no reason returned'}
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
          </div>
        </>
      )}
      <DcModal
        open={confirmBook !== null}
        title={confirmBook ? `Book ${confirmBook.invoice} with the courier?` : 'Book shipment'}
        subtitle="This hands the parcel to the courier and creates a real consignment. It cannot be undone from this screen."
        confirmLabel="Book shipment"
        busy={book.isPending}
        onClose={() => setConfirmBook(null)}
        onConfirm={() => confirmBook && book.mutate(confirmBook.orderId)}
      />

      <DcModal
        open={confirmRetry !== null}
        title={confirmRetry ? `Retry booking for ${confirmRetry.invoice}?` : 'Retry booking'}
        subtitle="Sends the parcel to the courier again. If the original failure was bad recipient data, fix the order first or it will fail the same way."
        confirmLabel="Retry booking"
        busy={retry.isPending}
        onClose={() => setConfirmRetry(null)}
        onConfirm={() => confirmRetry && retry.mutate(confirmRetry.orderId)}
      />
    </>
  )
}

function MobileCourierList({
  rows,
  onOpenOrder,
  onBook,
  onRetry,
}: {
  rows: CourierShipmentRow[]
  onOpenOrder: (invoice: string) => void
  onBook: (orderId: string, invoice: string) => void
  onRetry: (orderId: string, invoice: string) => void
}) {
  return (
    <div className="dc-mobile-route-panel" aria-label="Courier">
      {rows.length === 0 ? (
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
          No shipments in the queue.
        </div>
      ) : (
        <div className="dc-mobile-list">
          {rows.map((s) => {
            const status = (s.status || 'PENDING').toUpperCase()
            const tone = toneStyle(STATE_TONE[status] ?? 'mute')
            const invoice = s.order?.invoiceNumber ?? s.orderId
            const canBook = status === 'PENDING' || status === 'QUEUED'
            const canRetry = status === 'FAILED' || status === 'CANCELLED'
            return (
              <div key={s.id} className="dc-mobile-list-card dc-mobile-list-card--static">
                <button
                  type="button"
                  className="dc-mobile-list-card__main"
                  onClick={() => onOpenOrder(invoice)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    flex: 1,
                    minWidth: 0,
                    border: 0,
                    background: 'transparent',
                    padding: 0,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span
                    className="dc-mobile-list-card__icon"
                    style={{ background: tone.bg, color: tone.fg }}
                  >
                    <DcIcon name="icon-truck" size={15} />
                  </span>
                  <span className="dc-mobile-list-card__copy">
                    <span className="dc-mobile-list-card__title">
                      {invoice} · {s.order?.shippingName ?? 'Recipient'}
                    </span>
                    <span className="dc-mobile-list-card__sub">
                      {label(status)} · {s.provider ?? '—'} · {s.consignmentId ?? 'no CN'}
                    </span>
                  </span>
                </button>
                {canBook || canRetry ? (
                  <button
                    type="button"
                    className="dc-mobile-chip"
                    data-on="true"
                    onClick={() =>
                      canBook ? onBook(s.orderId, invoice) : onRetry(s.orderId, invoice)
                    }
                  >
                    {canBook ? 'Book' : 'Retry'}
                  </button>
                ) : null}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Kpi({
  label: text,
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
      <span
        style={{
          font: `600 11px/1 ${FONT}`,
          letterSpacing: '.09em',
          textTransform: 'uppercase',
          color: 'var(--ink-3)',
        }}
      >
        {text}
      </span>
      <span
        style={{ font: `700 26px/1 ${FONT}`, letterSpacing: '-.025em', color: color ?? 'var(--ink)' }}
      >
        {value}
      </span>
      <span style={{ font: `400 11.5px/1 ${FONT}`, color: 'var(--ink-3)' }}>{sub}</span>
    </div>
  )
}
