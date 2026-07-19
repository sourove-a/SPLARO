'use client'

import { useState, useEffect } from 'react'
import {
  toastFail,
  refreshWithToast,
  toastApiSaved,
} from '@/lib/admin/feedback'
import {
  verifyDeleteSuccess,
  verifyOrderStatus,
  verifyPaymentStatus,
  verifyCodRisk,
  verifyOrderNote,
  verifyReturnStatus,
  verifyOrderPaymentPersisted,
} from '@/lib/admin/mutation-verify'
import { confirmCourierBookingSaved } from '@/lib/admin/courier-save'
import {
  ArrowLeft, MapPin, Phone, CreditCard, Truck, Bot,
  MessageSquare, RefreshCw, XCircle, Trash2, AlertTriangle, RotateCcw,
} from 'lucide-react'
import { AdminButton, AdminLinkButton } from '@/components/ui/AdminButton'
import { OrdersPanel } from '@/components/modules/OrdersPanel'
import { OrderFulfillmentStepper } from '@/components/orders/OrderFulfillmentStepper'
import { OrderCreatePanel } from '@/components/modules/OrderCreatePanel'
import { InvoiceActionsBar } from '@/components/modules/InvoiceActionsBar'
import {
  useOrder,
  useUpdateOrderStatus,
  useDeleteOrder,
  useBookCourier,
  usePermission,
  useSetOrderCodRisk,
  useAddOrderNote,
  useUpdateOrderPayment,
  useCreateReturn,
} from '@/lib/api/hooks'
import { useInfrastructureConfig } from '@/lib/api/integration-hooks'
import { mapPaymentMethod, mapOrderStatus, type OrderPaymentStatus } from '@/lib/api/orders'
import type { ModuleContextProps } from '@/lib/modules/module-data'
import { formatBDT } from '@/lib/utils/currency'
import { useAdminNavigate } from '@/lib/navigation/client-nav'
import { useAdminUiStore } from '@/store/uiStore'

// ─── Design tokens ──────────────────────────────────────────────────────────
const GOLD = '#16181d'
const GOLD_LIGHT = 'rgba(16, 17, 20, 0.10)'
const GOLD_BORDER = 'rgba(16, 17, 20, 0.32)'


const TH: React.CSSProperties = { padding: '10px 16px', textAlign: 'left', fontSize: 10, fontWeight: 800, color: 'var(--admin-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid rgba(255,255,255,0.5)', whiteSpace: 'nowrap' }
const TD: React.CSSProperties = { padding: '11px 16px', fontSize: 13, color: 'var(--admin-text-secondary)', borderBottom: '1px solid rgba(255,255,255,0.4)' }

const STATUS_MAP: Record<string, { bg: string; text: string; border: string }> = {
  confirmed:   { bg: 'rgba(59,130,246,0.10)',  text: '#1D4ED8', border: 'rgba(59,130,246,0.30)' },
  processing:  { bg: 'rgba(59,130,246,0.10)',  text: '#1D4ED8', border: 'rgba(59,130,246,0.30)' },
  packed:      { bg: 'rgba(139,92,246,0.10)',  text: '#6D28D9', border: 'rgba(139,92,246,0.30)' },
  shipped:     { bg: 'rgba(22,163,74,0.10)',   text: '#15803D', border: 'rgba(22,163,74,0.30)' },
  delivered:   { bg: 'rgba(22,163,74,0.10)',   text: '#15803D', border: 'rgba(22,163,74,0.30)' },
  pending:     { bg: 'rgba(245,158,11,0.10)',  text: '#B45309', border: 'rgba(245,158,11,0.30)' },
  cancelled:   { bg: 'rgba(239,68,68,0.10)',   text: '#B91C1C', border: 'rgba(239,68,68,0.30)' },
}

function StatusPill({ value }: { value: string }) {
  const fallback = { bg: 'rgba(156,163,175,0.10)', text: '#4B5563', border: 'rgba(156,163,175,0.30)' }
  const s = STATUS_MAP[value.toLowerCase()] ?? fallback
  return <span style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.text, borderRadius: 8, padding: '2px 10px', fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap' }}>{value}</span>
}

function SideCard({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <section className="settings-card admin-panel-glass" style={{ padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Icon style={{ width: 16, height: 16, color: GOLD }} />
        <p style={{ fontSize: 10, fontWeight: 800, color: 'var(--admin-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>{title}</p>
      </div>
      {children}
    </section>
  )
}

const PAYMENT_STATUS_OPTIONS: { value: OrderPaymentStatus; label: string }[] = [
  { value: 'UNPAID', label: 'Unpaid' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'PAID', label: 'Paid' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'REFUNDED', label: 'Refunded' },
  { value: 'PARTIALLY_REFUNDED', label: 'Partially refunded' },
]

export function OrderDetailPanel({ recordId, moduleHref }: { recordId: string; moduleHref: string }) {
  const { navigate } = useAdminNavigate()
  const { data: order, isLoading, isError, refetch } = useOrder(recordId)
  const { data: steadfast } = useInfrastructureConfig('steadfast')
  const updateStatus = useUpdateOrderStatus()
  const deleteOrderMutation = useDeleteOrder()
  const setCodRisk = useSetOrderCodRisk()
  const addNote = useAddOrderNote()
  const updatePayment = useUpdateOrderPayment()
  const createReturn = useCreateReturn()
  const canDeleteOrders = usePermission('orders', 'delete')
  const canEditOrders = usePermission('orders', 'edit')
  const bookCourier = useBookCourier()
  const openAgentChat = useAdminUiStore((s) => s.openAgentChat)
  const courierReady = Boolean(steadfast?.configured)
  const [noteDraft, setNoteDraft] = useState('')
  const [returnReason, setReturnReason] = useState('')
  const [showReturnForm, setShowReturnForm] = useState(false)
  const [requireAdvance, setRequireAdvance] = useState(false)

  useEffect(() => {
    setRequireAdvance(Boolean(order?.requireAdvancePayment))
  }, [order?.requireAdvancePayment])

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '48px 0', fontSize: 13, fontWeight: 700, color: 'var(--admin-text-muted)' }}>
        <RefreshCw style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />
        Loading order…
      </div>
    )
  }

  if (isError || !order) {
    return (
      <div style={{ padding: '32px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: '#B91C1C' }}>Order not found or API unavailable.</p>
        <AdminLinkButton href={moduleHref} variant="ghost"><ArrowLeft style={{ width: 16, height: 16 }} /> Back to orders</AdminLinkButton>
      </div>
    )
  }

  const items = order.items?.map((item) => ({
    name: `${item.product?.name ?? item.productName ?? 'Item'}${item.variant?.size ? ` · ${item.variant.size}` : ''}`,
    qty: item.quantity,
    price: Number(item.price ?? 0),
  })) ?? []

  const subtotal = Number(order.subtotal ?? items.reduce((s, i) => s + i.price * i.qty, 0))
  const shipping = Number(order.deliveryCharge ?? 0)
  const total = Number(order.total ?? subtotal + shipping)
  const status = mapOrderStatus(order.status)
  const payment = mapPaymentMethod(order.paymentMethod)

  const handleCancelOrder = async () => {
    if (!window.confirm(`Cancel order ${order.invoiceNumber}?`)) return
    try {
      const saved = await updateStatus.mutateAsync({
        id: order.id,
        status: 'CANCELLED',
        note: 'Cancelled from admin panel',
      })
      if (!verifyOrderStatus(saved, 'CANCELLED')) return
      toastApiSaved(`Order ${order.invoiceNumber} cancellation`)
      void refetch()
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'Could not cancel order.')
    }
  }

  const handleDeleteOrder = async () => {
    if (!window.confirm(`Delete order ${order.invoiceNumber}? This cannot be undone.`)) return
    try {
      const result = await deleteOrderMutation.mutateAsync(order.id)
      if (!verifyDeleteSuccess(result)) return
      toastApiSaved(`Order ${order.invoiceNumber}`)
      window.location.href = moduleHref
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'Could not delete order.')
    }
  }

  const handleAdvanceStatus = async (nextStatus: string, note: string) => {
    try {
      const saved = await updateStatus.mutateAsync({ id: order.id, status: nextStatus, note })
      if (!verifyOrderStatus(saved, nextStatus)) return
      toastApiSaved(`Order ${order.invoiceNumber}`)
      void refetch()
    } catch {
      toastFail('Could not update order status.')
    }
  }

  const handleCodRiskToggle = async () => {
    const next = !order.isCodRisk
    try {
      const saved = await setCodRisk.mutateAsync({
        id: order.id,
        isCodRisk: next,
        requireAdvancePayment: next ? requireAdvance : false,
      })
      if (!verifyCodRisk(saved, next)) return
      toastApiSaved(`Order ${order.invoiceNumber} COD risk`)
      void refetch()
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'Could not update COD risk flag.')
    }
  }

  const handleAddNote = async () => {
    const body = noteDraft.trim()
    if (!body) return
    try {
      const saved = await addNote.mutateAsync({ id: order.id, body })
      if (!verifyOrderNote(saved, body)) return
      toastApiSaved(`Order ${order.invoiceNumber} note`)
      setNoteDraft('')
      void refetch()
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'Could not save order note.')
    }
  }

  const handlePaymentStatusChange = async (paymentStatus: OrderPaymentStatus) => {
    if (paymentStatus === order.paymentStatus) return
    try {
      const saved = await updatePayment.mutateAsync({ id: order.id, paymentStatus })
      if (!verifyPaymentStatus(saved, paymentStatus)) return
      if (!(await verifyOrderPaymentPersisted(order.id, paymentStatus))) return
      toastApiSaved(`Order ${order.invoiceNumber} payment`)
      void refetch()
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'Could not update payment status.')
    }
  }

  const handleOpenReturn = async () => {
    const reason = returnReason.trim()
    if (!reason) {
      toastFail('Enter a return reason.')
      return
    }
    try {
      const saved = await createReturn.mutateAsync({
        orderId: order.id,
        reason,
        description: `Opened from order ${order.invoiceNumber}`,
      })
      if (!verifyReturnStatus(saved, 'pending')) return
      toastApiSaved(`Return ${saved.rmaNumber}`)
      setReturnReason('')
      setShowReturnForm(false)
      navigate(`/dashboard/returns-rma`)
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'Could not open return request.')
    }
  }

  const handleBookCourier = async () => {
    try {
      const res = await bookCourier.mutateAsync({ id: order.id })
      const ok = await confirmCourierBookingSaved(res, order.id, order.invoiceNumber)
      if (ok) void refetch()
    } catch {
      toastFail('Could not book courier — is the API running?')
    }
  }

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <AdminLinkButton href={moduleHref} variant="ghost">
        <ArrowLeft style={{ width: 16, height: 16 }} />
        Back to orders
      </AdminLinkButton>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16, alignItems: 'start' }}>
        <div className="settings-card admin-panel-glass" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <p style={{ fontSize: 10, fontWeight: 800, color: 'var(--admin-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Order</p>
              <h2 style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 900, color: 'var(--admin-text-primary)', margin: '0 0 8px' }}>{order.invoiceNumber}</h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                <StatusPill value={status} />
                {order.isCodRisk ? (
                  <span style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.35)', color: '#B45309', borderRadius: 8, padding: '2px 10px', fontSize: 11, fontWeight: 800 }}>
                    COD risk
                  </span>
                ) : null}
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {canEditOrders && order.status === 'PENDING' ? (
                <AdminButton
                  variant="gold"
                  loading={updateStatus.isPending}
                  onClick={() => void handleAdvanceStatus('CONFIRMED', 'Confirmed from order detail')}
                >
                  Confirm order
                </AdminButton>
              ) : null}
              {canEditOrders && !order.courier?.consignmentId && order.status !== 'CANCELLED' ? (
                <AdminButton
                  variant="gold"
                  disabled={!courierReady}
                  loading={bookCourier.isPending}
                  title={
                    courierReady
                      ? 'Book Steadfast courier'
                      : 'Steadfast not configured — Settings → Infrastructure'
                  }
                  onClick={() => void handleBookCourier()}
                >
                  <Truck style={{ width: 16, height: 16 }} /> Book courier
                </AdminButton>
              ) : null}
              <AdminButton
                onClick={() =>
                  openAgentChat(
                    `${order.invoiceNumber} order detail দাও — status, payment, customer, courier`,
                    `Order page context: invoice=${order.invoiceNumber} id=${order.id} status=${order.status} phone=${order.shippingPhone}`,
                  )
                }
              >
                <Bot style={{ width: 16, height: 16 }} /> Ask AI
              </AdminButton>
              <AdminButton onClick={() => { void refreshWithToast(() => refetch(), 'Order refreshed.') }}><RefreshCw style={{ width: 16, height: 16 }} /> Refresh</AdminButton>
              {canEditOrders && order.status !== 'CANCELLED' && order.status !== 'DELIVERED' ? (
                <AdminButton variant="warning" loading={updateStatus.isPending} onClick={() => void handleCancelOrder()}>
                  <XCircle style={{ width: 16, height: 16 }} /> Cancel
                </AdminButton>
              ) : null}
              {canDeleteOrders && (
                <AdminButton variant="danger" loading={deleteOrderMutation.isPending} onClick={() => void handleDeleteOrder()}>
                  <Trash2 style={{ width: 16, height: 16 }} /> Delete
                </AdminButton>
              )}
            </div>
          </div>

          <OrderFulfillmentStepper
            status={order.status}
            loading={updateStatus.isPending}
            disabled={!canEditOrders}
            onAdvance={(nextStatus, note) => void handleAdvanceStatus(nextStatus, note)}
          />

          <div className="settings-card admin-panel-glass-subtle" style={{ overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Product', 'Qty', 'Price', 'Subtotal'].map((h) => <th key={h} style={TH}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.name}>
                    <td style={{ ...TD, fontWeight: 700, color: 'var(--admin-text-primary)' }}>{item.name}</td>
                    <td style={TD}>{item.qty}</td>
                    <td style={TD}>{formatBDT(item.price)}</td>
                    <td style={{ ...TD, fontWeight: 900, color: 'var(--admin-text-primary)' }}>{formatBDT(item.price * item.qty)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[['Subtotal', formatBDT(subtotal)], ['Shipping', formatBDT(shipping)]].map(([l, v]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600, color: 'var(--admin-text-muted)' }}>
                <span>{l}</span><span>{v}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 900, color: 'var(--admin-text-primary)' }}>
              <span>Total</span><span style={{ color: GOLD }}>{formatBDT(total)}</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <InvoiceActionsBar orderId={order.id} invoiceNumber={order.invoiceNumber} customerPhone={order.shippingPhone} />

          <SideCard title="Customer" icon={Phone}>
            <p style={{ fontSize: 14, fontWeight: 900, color: 'var(--admin-text-primary)', margin: 0 }}>{order.shippingName}</p>
            <p style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--admin-text-muted)', margin: '6px 0 0' }}>
              <Phone style={{ width: 12, height: 12 }} />{order.shippingPhone}
            </p>
            <button type="button" style={{ marginTop: 10, width: '100%', background: GOLD_LIGHT, border: `1px solid ${GOLD_BORDER}`, color: '#8B6914', borderRadius: 10, padding: '7px 0', fontSize: 12, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} onClick={() => { const p = order.shippingPhone.replace(/\D/g, ''); window.open(`https://wa.me/88${p.startsWith('0') ? p.slice(1) : p}`, '_blank') }}>
              <MessageSquare style={{ width: 14, height: 14 }} /> WhatsApp customer
            </button>
          </SideCard>

          <SideCard title="Shipping" icon={MapPin}>
            <p style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--admin-text-primary)', margin: 0 }}>
              <MapPin style={{ width: 14, height: 14, color: GOLD, flexShrink: 0, marginTop: 1 }} />
              {[order.shippingAddress, order.shippingCity, order.shippingDistrict].filter(Boolean).join(', ')}
            </p>
            <p style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--admin-text-muted)', margin: '8px 0 0' }}>
              <Truck style={{ width: 12, height: 12 }} />
              {order.courier?.provider ?? 'Not assigned'}
              {order.courier?.consignmentId ? ` · ${order.courier.consignmentId}` : ''}
            </p>
            {!order.courier?.consignmentId ? (
              <>
                {!courierReady ? (
                  <p className="mt-3 text-[11px] font-bold text-amber-700 dark:text-amber-300">
                    Steadfast not configured — save keys in Settings → Infrastructure before booking.
                  </p>
                ) : null}
                <AdminButton
                  variant="gold"
                  size="sm"
                  className="mt-3 w-full"
                  disabled={!courierReady}
                  loading={bookCourier.isPending}
                  onClick={() => void handleBookCourier()}
                >
                  <Truck style={{ width: 14, height: 14 }} /> Book courier
                </AdminButton>
              </>
            ) : null}
          </SideCard>

          <SideCard title="Payment" icon={CreditCard}>
            <p style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--admin-text-primary)', margin: 0 }}>
              <CreditCard style={{ width: 16, height: 16, color: GOLD }} />{payment}
            </p>
            {canEditOrders ? (
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 10, fontWeight: 800, color: 'var(--admin-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Payment status
                </label>
                <select
                  value={order.paymentStatus}
                  disabled={updatePayment.isPending}
                  onChange={(e) => void handlePaymentStatusChange(e.target.value as OrderPaymentStatus)}
                  style={{
                    width: '100%',
                    borderRadius: 10,
                    border: '1px solid var(--admin-glass-border)',
                    background: 'var(--admin-surface)',
                    padding: '8px 10px',
                    fontSize: 12,
                    fontWeight: 700,
                    color: 'var(--admin-text-primary)',
                  }}
                >
                  {PAYMENT_STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            ) : (
              <p style={{ fontSize: 12, color: 'var(--admin-text-muted)', margin: '4px 0 0' }}>Status: {order.paymentStatus}</p>
            )}
          </SideCard>

          {(order.paymentMethod === 'CASH_ON_DELIVERY' || order.isCodRisk) && canEditOrders ? (
            <SideCard title="COD risk" icon={AlertTriangle}>
              <p style={{ fontSize: 12, color: 'var(--admin-text-muted)', margin: '0 0 10px' }}>
                Flag high-risk COD orders and optionally require advance payment before fulfillment.
              </p>
              {order.customer?.codRiskScore !== undefined ? (
                <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--admin-text-primary)', margin: '0 0 10px' }}>
                  Customer COD score: {order.customer.codRiskScore}/100
                </p>
              ) : null}
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600, color: 'var(--admin-text-secondary)', marginBottom: 10 }}>
                <input
                  type="checkbox"
                  checked={requireAdvance}
                  onChange={(e) => setRequireAdvance(e.target.checked)}
                  disabled={setCodRisk.isPending}
                />
                Require advance payment when flagged
              </label>
              <AdminButton
                variant={order.isCodRisk ? 'ghost' : 'warning'}
                size="sm"
                className="w-full"
                loading={setCodRisk.isPending}
                onClick={() => void handleCodRiskToggle()}
              >
                <AlertTriangle style={{ width: 14, height: 14 }} />
                {order.isCodRisk ? 'Clear COD risk flag' : 'Flag as COD risk'}
              </AdminButton>
              {order.requireAdvancePayment ? (
                <p style={{ fontSize: 11, fontWeight: 700, color: '#B45309', margin: '8px 0 0' }}>
                  Advance payment required on this order
                </p>
              ) : null}
            </SideCard>
          ) : null}

          <SideCard title="Internal notes" icon={MessageSquare}>
            {order.internalNotes?.length ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: canEditOrders ? 12 : 0 }}>
                {order.internalNotes.map((note) => (
                  <div key={note.id} className="settings-card admin-panel-glass-subtle" style={{ padding: '8px 12px', fontSize: 12, fontWeight: 600, color: 'var(--admin-text-primary)' }}>
                    {note.body}
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: 12, color: 'var(--admin-text-muted)', margin: canEditOrders ? '0 0 12px' : 0 }}>
                No internal notes yet.
              </p>
            )}
            {canEditOrders ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <textarea
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  placeholder="Add a private note for staff…"
                  rows={3}
                  style={{
                    width: '100%',
                    borderRadius: 10,
                    border: '1px solid var(--admin-glass-border)',
                    background: 'var(--admin-surface)',
                    padding: '8px 10px',
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--admin-text-primary)',
                    resize: 'vertical',
                  }}
                />
                <AdminButton
                  size="sm"
                  variant="gold"
                  loading={addNote.isPending}
                  disabled={!noteDraft.trim()}
                  onClick={() => void handleAddNote()}
                >
                  Save note
                </AdminButton>
              </div>
            ) : null}
          </SideCard>

          {canEditOrders && order.status !== 'CANCELLED' ? (
            <SideCard title="Returns & refunds" icon={RotateCcw}>
              <p style={{ fontSize: 12, color: 'var(--admin-text-muted)', margin: '0 0 10px' }}>
                Open an RMA linked to this order. Refund workflow continues in Finance → Returns.
              </p>
              {showReturnForm ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <input
                    type="text"
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                    placeholder="Return reason (required)"
                    style={{
                      width: '100%',
                      borderRadius: 10,
                      border: '1px solid var(--admin-glass-border)',
                      background: 'var(--admin-surface)',
                      padding: '8px 10px',
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <AdminButton
                      variant="gold"
                      size="sm"
                      loading={createReturn.isPending}
                      disabled={!returnReason.trim()}
                      onClick={() => void handleOpenReturn()}
                    >
                      Submit RMA
                    </AdminButton>
                    <AdminButton size="sm" variant="ghost" onClick={() => setShowReturnForm(false)}>
                      Cancel
                    </AdminButton>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <AdminButton size="sm" variant="gold" onClick={() => setShowReturnForm(true)}>
                    <RotateCcw style={{ width: 14, height: 14 }} /> Open return request
                  </AdminButton>
                  <AdminButton size="sm" variant="ghost" onClick={() => navigate('/dashboard/returns-rma')}>
                    View all returns
                  </AdminButton>
                </div>
              )}
            </SideCard>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export function OrdersModulePanel({ moduleHref, subPath, action }: ModuleContextProps) {
  if (action === 'create') return <OrderCreatePanel moduleHref={moduleHref} />
  if (action === 'detail' && subPath?.[0]) return <OrderDetailPanel recordId={subPath[0]} moduleHref={moduleHref} />
  return <OrdersPanel />
}
