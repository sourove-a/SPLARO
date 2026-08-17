'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

import { DcIcon } from '@/components/dc/DcIcon'
import { DcModal } from '@/components/dc/DcModal'
import { useDcScreen } from '@/components/dc/DcScreenContext'
import { FONT, MONO, formatTaka, statusToneStyle } from '@/components/dc/tokens'
import { resolveMediaUrl } from '@/lib/media-url'
import { downloadInvoice } from '@/lib/admin/admin-actions'
import { formatBdPhone, operatorOf, telHref } from '@/lib/format/bd-phone'
import { formatCleanAddress } from '@splaro/config'
import { verifyDeleteSuccess } from '@/lib/admin/mutation-verify'
import { useDeleteOrder, useOrder, usePermission, useUpdateOrderStatus } from '@/lib/api/hooks'
import type { ApiOrder } from '@/lib/api/orders'

/** The fulfilment ladder, in the order the floor works it. */
const FLOW = ['PENDING', 'CONFIRMED', 'PROCESSING', 'PACKED', 'SHIPPED', 'DELIVERED'] as const
const FLOW_ICON = [
  'icon-clock',
  'icon-check',
  'icon-cog',
  'icon-package',
  'icon-truck',
  'icon-house',
]
const FLOW_LABEL = ['Pending', 'Confirmed', 'Processing', 'Packed', 'Shipped', 'Delivered']

const card = {
  border: '1px solid var(--line)',
  borderRadius: 14,
  background: 'var(--surface)',
  backgroundImage: 'var(--card-sheen)',
} as const

const sectionTitle = { font: `600 13px/1 ${FONT}`, color: 'var(--ink)' } as const

function titleCase(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}

function initialsOf(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w.charAt(0))
      .join('')
      .slice(0, 2)
      .toUpperCase() || '—'
  )
}

function money(v: number | string | undefined) {
  return formatTaka(Number(v ?? 0))
}

export interface DcOrderDrawerProps {
  orderId: string | null
  onClose: () => void
}

/**
 * Order detail as the design specifies it — a right-hand drawer over the list,
 * not a separate page. Escape and the backdrop both close it.
 */
export function DcOrderDrawer({ orderId, onClose }: DcOrderDrawerProps) {
  const router = useRouter()
  const { toast } = useDcScreen()
  const order = useOrder(orderId ?? '')
  const advance = useUpdateOrderStatus()
  const deleteOrder = useDeleteOrder()
  const canDeleteOrders = usePermission('orders', 'delete')
  const [confirmAdvance, setConfirmAdvance] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')

  useEffect(() => {
    if (!orderId) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [orderId, onClose])

  const d = order.data as ApiOrder | undefined

  const stepIndex = useMemo(() => {
    if (!d) return -1
    return FLOW.indexOf(d.status.toUpperCase() as (typeof FLOW)[number])
  }, [d])

  const nextStatus = stepIndex >= 0 && stepIndex < FLOW.length - 1 ? FLOW[stepIndex + 1] : null
  const terminal = d ? ['CANCELLED', 'RETURNED'].includes(d.status.toUpperCase()) : false

  if (!orderId) return null

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 60,
          background: 'var(--overlay)',
          animation: 'dc-fadein 140ms ease-out',
        }}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={d ? `Order ${d.invoiceNumber}` : 'Order detail'}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          zIndex: 61,
          width: 'min(580px, 100vw)',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg)',
          borderLeft: '1px solid var(--line-2)',
          animation: 'dc-slidein 200ms cubic-bezier(.22,.9,.3,1)',
          fontFamily: FONT,
        }}
      >
        <header
          style={{
            flex: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 11,
            padding: '14px 16px',
            borderBottom: '1px solid var(--line)',
            background: 'var(--surface)',
          }}
        >
          <span
            style={{
              font: `700 15px/1 ${MONO}`,
              letterSpacing: '-.01em',
              color: 'var(--ink)',
            }}
          >
            {d?.invoiceNumber ?? '…'}
          </span>
          {d ? <Chip label={titleCase(d.status)} tone={statusToneStyle(titleCase(d.status))} /> : null}
          <div style={{ flex: 1 }} />
          <IconBtn
            icon="icon-copy"
            title="Copy order ID"
            onClick={() => {
              if (!d) return
              void navigator.clipboard
                ?.writeText(d.invoiceNumber)
                .then(() => toast('ok', 'Copied', `${d.invoiceNumber} is on the clipboard.`))
                .catch(() => toast('warn', 'Could not copy', 'The clipboard is blocked here.'))
            }}
          />
          <IconBtn icon="icon-x" title="Close" onClick={onClose} />
        </header>

        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          {order.isLoading ? (
            <Note text="Loading the order…" />
          ) : order.error ? (
            <div
              style={{
                border: '1px solid var(--bad-bd)',
                borderRadius: 14,
                background: 'var(--bad-soft)',
                padding: '15px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <span style={{ ...sectionTitle }}>This order could not load</span>
              <code
                style={{
                  padding: '10px 12px',
                  borderRadius: 9,
                  border: '1px solid var(--line)',
                  background: 'var(--surface)',
                  font: `500 12px/1.55 ${MONO}`,
                  color: 'var(--ink)',
                  overflowX: 'auto',
                }}
              >
                GET /admin/orders/{orderId} →{' '}
                {order.error instanceof Error ? order.error.message : '500 Internal Server Error'}
              </code>
              <button
                type="button"
                onClick={() => void order.refetch()}
                style={{
                  alignSelf: 'flex-start',
                  height: 32,
                  padding: '0 13px',
                  borderRadius: 9,
                  border: '1px solid var(--bad-bd)',
                  background: 'transparent',
                  color: 'var(--bad)',
                  cursor: 'pointer',
                  font: `600 12.5px/1 ${FONT}`,
                }}
              >
                Retry
              </button>
            </div>
          ) : !d ? (
            <Note text="No order returned for this id." />
          ) : (
            <>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  flexWrap: 'wrap',
                  font: `400 11.5px/1.5 ${FONT}`,
                  color: 'var(--ink-3)',
                }}
              >
                <span>
                  Placed{' '}
                  {new Date(d.createdAt).toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
                <Dot />
                <span>{d.paymentMethod}</span>
                <Dot />
                <span>
                  {d.items?.length ?? 0} item{(d.items?.length ?? 0) === 1 ? '' : 's'}
                </span>
              </div>

              {/* ── fulfilment ladder ───────────────────────────── */}
              <div
                style={{
                  ...card,
                  padding: '15px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                <span style={sectionTitle}>Fulfilment</span>
                {terminal ? (
                  <span style={{ font: `500 12.5px/1.5 ${FONT}`, color: 'var(--bad)' }}>
                    This order is {titleCase(d.status)} — it has left the fulfilment ladder.
                  </span>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0 }}>
                    {FLOW.map((step, i) => {
                      const done = stepIndex >= i
                      const current = stepIndex === i
                      const fg = done ? 'var(--ok)' : 'var(--ink-3)'
                      const line = (active: boolean) =>
                        active ? 'var(--ok)' : 'var(--line-2)'
                      return (
                        <div
                          key={step}
                          style={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 7,
                            minWidth: 0,
                          }}
                        >
                          <span style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                            <span
                              style={{
                                height: 2,
                                flex: 1,
                                background: i === 0 ? 'transparent' : line(stepIndex >= i),
                              }}
                            />
                            <span
                              style={{
                                display: 'grid',
                                placeItems: 'center',
                                width: 20,
                                height: 20,
                                flex: 'none',
                                borderRadius: 99,
                                border: `1.5px solid ${done ? 'var(--ok)' : 'var(--line-2)'}`,
                                background: current
                                  ? 'var(--ok-soft)'
                                  : done
                                    ? 'var(--ok-soft)'
                                    : 'var(--surface)',
                                color: fg,
                              }}
                            >
                              <DcIcon name={FLOW_ICON[i]!} size={10} />
                            </span>
                            <span
                              style={{
                                height: 2,
                                flex: 1,
                                background:
                                  i === FLOW.length - 1 ? 'transparent' : line(stepIndex > i),
                              }}
                            />
                          </span>
                          <span
                            style={{
                              textAlign: 'center',
                              font: `600 10px/1.3 ${FONT}`,
                              letterSpacing: '.02em',
                              color: done ? 'var(--ink)' : 'var(--ink-3)',
                              padding: '0 2px',
                            }}
                          >
                            {FLOW_LABEL[i]}
                          </span>
                          <span
                            style={{
                              textAlign: 'center',
                              font: `400 9.5px/1 ${MONO}`,
                              color: 'var(--ink-3)',
                            }}
                          >
                            {/* Only the first and current steps have a timestamp the API
                                actually gives us. The rest stay blank rather than invented. */}
                            {i === 0
                              ? new Date(d.createdAt).toLocaleTimeString('en-GB', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : current
                                ? new Date(d.updatedAt).toLocaleTimeString('en-GB', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : '—'}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* ── items ───────────────────────────────────────── */}
              <div style={{ ...card, padding: '15px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <span style={sectionTitle}>Items</span>
                {(d.items ?? []).map((it) => {
                  const name = it.productName ?? it.product?.name ?? 'Product'
                  const variant = [it.variant?.size, it.variant?.color].filter(Boolean).join(' · ')
                  // The drawer used to render a striped placeholder unconditionally —
                  // the order item carries an image on three possible fields.
                  const rawThumb =
                    it.image ?? it.variant?.image ?? it.product?.images?.[0]?.url ?? null
                  const thumb = rawThumb ? resolveMediaUrl(rawThumb) : null
                  return (
                    <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                      <span
                        style={{
                          display: 'grid',
                          placeItems: 'center',
                          width: 40,
                          height: 48,
                          flex: 'none',
                          borderRadius: 8,
                          border: '1px solid var(--line)',
                          background: thumb
                            ? 'var(--surface-2)'
                            : 'repeating-linear-gradient(135deg, var(--surface-2), var(--surface-2) 5px, var(--surface-3) 5px, var(--surface-3) 10px)',
                          color: 'var(--ink-3)',
                          overflow: 'hidden',
                        }}
                      >
                        {thumb ? (
                          // eslint-disable-next-line @next/next/no-img-element -- remote/upload URLs; next/image not wired for admin thumbs
                          <img
                            src={thumb}
                            alt=""
                            width={40}
                            height={48}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          <DcIcon name="icon-image" size={13} />
                        )}
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
                        <span style={{ font: `500 12.5px/1.3 ${FONT}`, color: 'var(--ink)' }}>
                          {name}
                        </span>
                        {variant ? (
                          <span style={{ font: `400 11.5px/1.3 ${FONT}`, color: 'var(--ink-3)' }}>
                            {variant}
                          </span>
                        ) : null}
                        {/* Snapshot first — support answers the customer with
                            the code that was on their invoice, not the one the
                            product carries after a later edit. */}
                        {(it.productCode ?? it.product?.productCode) || it.sku ? (
                          <span style={{ font: `500 10.5px/1.3 ${MONO}`, color: 'var(--ink-3)' }}>
                            {(it.productCode ?? it.product?.productCode)
                              ? `Code ${it.productCode ?? it.product?.productCode}`
                              : ''}
                            {(it.productCode ?? it.product?.productCode) && it.sku ? ' · ' : ''}
                            {it.sku ? `SKU ${it.sku}` : ''}
                          </span>
                        ) : null}
                      </span>
                      <span
                        style={{
                          flex: 'none',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'flex-end',
                          gap: 3,
                        }}
                      >
                        <span style={{ font: `600 12.5px/1 ${MONO}`, color: 'var(--ink)' }}>
                          {money(it.subtotal ?? Number(it.price ?? 0) * it.quantity)}
                        </span>
                        <span style={{ font: `400 11px/1 ${MONO}`, color: 'var(--ink-3)' }}>
                          {it.quantity} × {money(it.price)}
                        </span>
                      </span>
                    </div>
                  )
                })}

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 7,
                    paddingTop: 11,
                    borderTop: '1px solid var(--line)',
                  }}
                >
                  <TotalRow label="Subtotal" value={money(d.subtotal)} />
                  <TotalRow label="Delivery" value={money(d.deliveryCharge)} />
                  <TotalRow label="Total" value={money(d.total)} strong />
                </div>
              </div>

              {/* ── customer + payment ──────────────────────────── */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%), 1fr))',
                  gap: 12,
                }}
              >
                <div style={{ ...card, padding: '15px 16px', display: 'flex', flexDirection: 'column', gap: 11 }}>
                  <span style={sectionTitle}>Customer</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span
                      style={{
                        display: 'grid',
                        placeItems: 'center',
                        width: 32,
                        height: 32,
                        flex: 'none',
                        borderRadius: 99,
                        background: 'var(--violet-solid)',
                        color: 'var(--on-violet)',
                        font: `700 12px/1 ${FONT}`,
                      }}
                    >
                      {initialsOf(d.shippingName)}
                    </span>
                    <span
                      style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}
                    >
                      <span style={{ font: `600 12.5px/1.3 ${FONT}`, color: 'var(--ink)' }}>
                        {d.shippingName}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                        <a
                          href={telHref(d.shippingPhone)}
                          style={{
                            font: `500 11.5px/1.3 ${MONO}`,
                            color: 'var(--ink-2)',
                            borderBottom: '1px solid var(--line-2)',
                          }}
                        >
                          {formatBdPhone(d.shippingPhone)}
                        </a>
                        <span style={{ font: `400 10.5px/1 ${FONT}`, color: 'var(--ink-3)' }}>
                          {operatorOf(d.shippingPhone)}
                        </span>
                      </span>
                    </span>
                  </div>
                  <span
                    style={{
                      font: `400 11.5px/1.5 ${FONT}`,
                      color: 'var(--ink-3)',
                      textWrap: 'pretty',
                    }}
                  >
                    {formatCleanAddress(d.shippingAddress, d.shippingCity, d.shippingDistrict) || 'No address on the order'}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ flex: 1, font: `400 11px/1.4 ${FONT}`, color: 'var(--ink-3)' }}>
                      {d.customer?.loyaltyTier ? `${d.customer.loyaltyTier} tier` : 'Guest checkout'}
                      {d.isCodRisk ? ' · flagged COD risk' : ''}
                    </span>
                    <button
                      type="button"
                      disabled={!d.customer}
                      onClick={() => {
                        onClose()
                        router.push('/dashboard/customers')
                      }}
                      className="dc-hover-violet"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        height: 28,
                        padding: '0 10px',
                        borderRadius: 8,
                        border: '1px solid var(--line)',
                        background: 'var(--surface-2)',
                        color: 'var(--ink-2)',
                        cursor: d.customer ? 'pointer' : 'not-allowed',
                        font: `600 11.5px/1 ${FONT}`,
                        opacity: d.customer ? 1 : 0.55,
                      }}
                    >
                      <DcIcon name="icon-user" size={12} />
                      <span>360°</span>
                    </button>
                  </div>
                </div>

                <div style={{ ...card, padding: '15px 16px', display: 'flex', flexDirection: 'column', gap: 11 }}>
                  <span style={sectionTitle}>Payment &amp; courier</span>
                  <MetaRow label="Method" value={d.paymentMethod} />
                  <MetaRow label="Payment" value={titleCase(d.paymentStatus)} />
                  <MetaRow
                    label="Courier"
                    value={d.courier?.provider ?? 'Not booked'}
                  />
                  <MetaRow
                    label="Consignment"
                    value={d.courier?.consignmentId ?? d.courier?.trackingCode ?? '—'}
                    mono
                  />
                </div>
              </div>

              {/* ── timeline ────────────────────────────────────── */}
              <div style={{ ...card, padding: '15px 16px', display: 'flex', flexDirection: 'column', gap: 11 }}>
                <span style={sectionTitle}>Timeline</span>
                <TimelineRow
                  icon="icon-plus"
                  text="Order placed"
                  time={new Date(d.createdAt).toLocaleString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                />
                {(d.internalNotes ?? []).map((n) => (
                  <TimelineRow
                    key={n.id}
                    icon="icon-message-square"
                    text={n.body}
                    time={new Date(n.createdAt).toLocaleString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  />
                ))}
                {d.courier?.status ? (
                  <TimelineRow
                    icon="icon-truck"
                    text={`Courier · ${d.courier.status}`}
                    time="—"
                  />
                ) : null}
                <TimelineRow
                  icon="icon-clock"
                  text={`Currently ${titleCase(d.status)}`}
                  time={new Date(d.updatedAt).toLocaleString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                />
              </div>
            </>
          )}
        </div>

        <footer
          style={{
            flex: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '12px 16px',
            borderTop: '1px solid var(--line)',
            background: 'var(--surface)',
          }}
        >
          <FooterBtn
            icon="icon-printer"
            label="Invoice"
            disabled={!d}
            onClick={() => void (d && downloadInvoice(d.invoiceNumber?.trim() || d.id))}
          />
          <FooterBtn
            icon="icon-send"
            label="Message"
            disabled={!d}
            onClick={() => d && window.open(telHref(d.shippingPhone), '_self')}
          />
          {canDeleteOrders ? (
            <FooterBtn
              icon="icon-trash-2"
              label="Delete"
              danger
              disabled={!d || deleteOrder.isPending}
              onClick={() => {
                setDeleteConfirmation('')
                setConfirmDelete(true)
              }}
            />
          ) : null}
          <div style={{ flex: 1 }} />
          <button
            type="button"
            disabled={!nextStatus || advance.isPending || terminal}
            onClick={() => nextStatus && setConfirmAdvance(nextStatus)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              height: 36,
              padding: '0 15px',
              borderRadius: 9,
              cursor: nextStatus && !terminal ? 'pointer' : 'not-allowed',
              font: `600 12.5px/1 ${FONT}`,
              border: `1px solid ${nextStatus && !terminal ? 'var(--violet-solid)' : 'var(--line)'}`,
              background: nextStatus && !terminal ? 'var(--violet-solid)' : 'var(--surface-2)',
              color: nextStatus && !terminal ? 'var(--on-violet)' : 'var(--ink-3)',
              opacity: advance.isPending ? 0.7 : 1,
            }}
          >
            <DcIcon
              name={nextStatus ? FLOW_ICON[FLOW.indexOf(nextStatus)]! : 'icon-check'}
              size={14}
            />
            <span>
              {terminal
                ? 'Closed'
                : nextStatus
                  ? `Mark ${FLOW_LABEL[FLOW.indexOf(nextStatus)]}`
                  : 'Delivered'}
            </span>
          </button>
        </footer>
      </aside>

      <DcModal
        open={confirmAdvance !== null}
        title={
          d && confirmAdvance
            ? `Move ${d.invoiceNumber} to ${titleCase(confirmAdvance)}?`
            : 'Advance order'
        }
        subtitle="This writes the new status straight to the order and is visible to the customer."
        confirmLabel={confirmAdvance ? `Mark ${titleCase(confirmAdvance)}` : 'Confirm'}
        busy={advance.isPending}
        onClose={() => setConfirmAdvance(null)}
        onConfirm={() => {
          if (!d || !confirmAdvance) return
          advance.mutate(
            { id: d.id, status: confirmAdvance },
            {
              onSuccess: () => {
                setConfirmAdvance(null)
                toast(
                  'ok',
                  `${d.invoiceNumber} is ${titleCase(confirmAdvance)}`,
                  'The order and the dashboard counters were both updated.',
                )
              },
              onError: (err) => {
                setConfirmAdvance(null)
                toast(
                  'bad',
                  'Could not update the order',
                  err instanceof Error
                    ? err.message
                    : `PATCH /admin/orders/${d.id}/status failed`,
                )
              },
            },
          )
        }}
      />
      <DcModal
        open={confirmDelete}
        title={d ? `Delete ${d.invoiceNumber} permanently?` : 'Delete order permanently?'}
        subtitle="Order, invoice, payment, courier, return, stock reservation, loyalty reward, and related records will be removed. Inventory is restored. This cannot be undone."
        confirmLabel="Delete permanently"
        danger
        busy={deleteOrder.isPending}
        busyLabel="Deleting…"
        onClose={() => {
          if (deleteOrder.isPending) return
          setConfirmDelete(false)
          setDeleteConfirmation('')
        }}
        onConfirm={() => {
          if (!d) return
          if (deleteConfirmation.trim() !== d.invoiceNumber) {
            toast('bad', 'Confirmation does not match', `Type ${d.invoiceNumber} exactly.`)
            return
          }
          void deleteOrder
            .mutateAsync(d.id)
            .then((saved) => {
              if (!verifyDeleteSuccess(saved)) return
              toast(
                'ok',
                `${d.invoiceNumber} permanently deleted`,
                'Server confirmed deletion and restored inventory.',
              )
              setConfirmDelete(false)
              setDeleteConfirmation('')
              onClose()
            })
            .catch((err: unknown) => {
              toast(
                'bad',
                'Could not delete order',
                err instanceof Error ? err.message : `DELETE /admin/orders/${d.id} failed`,
              )
            })
        }}
      >
        <label style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <span style={{ font: `600 11px/1 ${FONT}`, color: 'var(--ink-3)' }}>
            Type {d?.invoiceNumber ?? 'order number'} to confirm
          </span>
          <input
            value={deleteConfirmation}
            onChange={(event) => setDeleteConfirmation(event.target.value)}
            autoComplete="off"
            spellCheck={false}
            style={{
              width: '100%',
              height: 38,
              padding: '0 11px',
              borderRadius: 9,
              border: '1px solid var(--bad-bd)',
              background: 'var(--surface-2)',
              color: 'var(--ink)',
              outline: 'none',
              font: `600 12.5px/1 ${MONO}`,
            }}
          />
        </label>
      </DcModal>
    </>
  )
}

/* ── small parts ─────────────────────────────────────────────────── */

function Dot() {
  return (
    <span style={{ width: 3, height: 3, borderRadius: 99, background: 'var(--line-2)' }} />
  )
}

function Chip({ label, tone }: { label: string; tone: { bg: string; fg: string; bd: string } }) {
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

function TotalRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span
        style={{
          flex: 1,
          font: `${strong ? 600 : 500} 12px/1 ${FONT}`,
          color: strong ? 'var(--ink)' : 'var(--ink-3)',
        }}
      >
        {label}
      </span>
      <span
        style={{
          font: `${strong ? 700 : 600} ${strong ? 14 : 12.5}px/1 ${MONO}`,
          color: 'var(--ink)',
        }}
      >
        {value}
      </span>
    </div>
  )
}

function MetaRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ flex: 1, font: `500 11.5px/1 ${FONT}`, color: 'var(--ink-3)' }}>{label}</span>
      <span
        style={{
          font: `600 12px/1 ${mono ? MONO : FONT}`,
          color: 'var(--ink)',
          textAlign: 'right',
        }}
      >
        {value}
      </span>
    </div>
  )
}

function TimelineRow({ icon, text, time }: { icon: string; text: string; time: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
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
        <DcIcon name={icon} size={12} />
      </span>
      <span
        style={{
          flex: 1,
          minWidth: 0,
          font: `500 12px/1.45 ${FONT}`,
          color: 'var(--ink-2)',
          textWrap: 'pretty',
        }}
      >
        {text}
      </span>
      <span
        style={{
          flex: 'none',
          font: `400 11px/1.5 ${MONO}`,
          color: 'var(--ink-3)',
          whiteSpace: 'nowrap',
        }}
      >
        {time}
      </span>
    </div>
  )
}

function FooterBtn({
  icon,
  label,
  onClick,
  disabled,
  danger,
}: {
  icon: string
  label: string
  onClick: () => void
  disabled?: boolean
  danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="dc-hover-ink"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        height: 36,
        padding: '0 13px',
        borderRadius: 9,
        border: `1px solid ${danger ? 'var(--bad-bd)' : 'var(--line)'}`,
        background: danger ? 'var(--bad-soft)' : 'var(--surface-2)',
        color: danger ? 'var(--bad)' : 'var(--ink-2)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        font: `600 12.5px/1 ${FONT}`,
        opacity: disabled ? 0.55 : 1,
      }}
    >
      <DcIcon name={icon} size={14} />
      <span>{label}</span>
    </button>
  )
}

function IconBtn({
  icon,
  title,
  onClick,
}: {
  icon: string
  title: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className="dc-hover-ink"
      style={{
        display: 'grid',
        placeItems: 'center',
        width: 30,
        height: 30,
        flex: 'none',
        borderRadius: 8,
        border: '1px solid var(--line)',
        background: 'var(--surface-2)',
        color: 'var(--ink-3)',
        cursor: 'pointer',
      }}
    >
      <DcIcon name={icon} size={14} />
    </button>
  )
}

function Note({ text }: { text: string }) {
  return (
    <div
      style={{
        padding: '40px 16px',
        textAlign: 'center',
        font: `400 12.5px/1.55 ${FONT}`,
        color: 'var(--ink-3)',
      }}
    >
      {text}
    </div>
  )
}
