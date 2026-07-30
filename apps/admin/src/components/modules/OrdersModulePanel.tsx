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
import { collectPaymentEvidence } from '@/lib/admin/payment-save'
import {
  ArrowLeft, MapPin, Phone, CreditCard, Truck, Bot,
  MessageSquare, RefreshCw, XCircle, Trash2, AlertTriangle, RotateCcw,
} from 'lucide-react'
import { AdminButton, AdminLinkButton } from '@/components/ui/AdminButton'
import { AdminStatusBadge, type AdminBadgeTone } from '@/components/ui/AdminStatusBadge'
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

const ORDER_STATUS_TONE: Record<string, AdminBadgeTone> = {
  confirmed: 'info',
  processing: 'info',
  packed: 'info',
  shipped: 'success',
  delivered: 'success',
  pending: 'warning',
  cancelled: 'danger',
}

function StatusPill({ value }: { value: string }) {
  return <AdminStatusBadge label={value} tone={ORDER_STATUS_TONE[value.toLowerCase()] ?? 'muted'} />
}

function SideCard({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <section className="admin-catalog-hero admin-panel-hero !mb-0 !p-5">
      <div className="admin-catalog-hero__title-row !mb-3">
        <span className="admin-catalog-icon-ring !h-7 !w-7">
          <Icon className="h-3.5 w-3.5" />
        </span>
        <p className="m-0 text-[10px] font-extrabold uppercase tracking-[0.06em] text-[var(--admin-text-muted)]">{title}</p>
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
        <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--admin-danger-strong)' }}>Order not found or API unavailable.</p>
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
      let evidence: { reference?: string; amount?: number } | undefined
      if (paymentStatus === 'PAID') {
        const collected = collectPaymentEvidence(Number(order.total))
        if (!collected) return
        evidence = collected
      }
      const saved = await updatePayment.mutateAsync({
        id: order.id,
        paymentStatus,
        ...evidence,
      })
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
    <div className="admin-panel-page mx-auto max-w-[960px] space-y-4">
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_280px]">
        <div className="admin-catalog-hero admin-panel-hero !mb-0 flex flex-col gap-5 !p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="mb-1 text-[10px] font-extrabold uppercase tracking-[0.06em] text-[var(--admin-text-muted)]">Order</p>
              <h2 className="mb-2 font-mono text-lg font-black text-[var(--admin-text-primary)]">{order.invoiceNumber}</h2>
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill value={status} />
                {order.isCodRisk ? (
                  <AdminStatusBadge label="COD risk" tone="warning" />
                ) : null}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
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

          <div className="admin-catalog-table-shell overflow-hidden">
            <table className="admin-catalog-data-table">
              <thead>
                <tr>
                  {['Product', 'Qty', 'Price', 'Subtotal'].map((h) => (
                    <th key={h} className="admin-catalog-th">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.name} className="admin-catalog-row">
                    <td className="admin-catalog-td admin-catalog-td--strong">{item.name}</td>
                    <td className="admin-catalog-td">{item.qty}</td>
                    <td className="admin-catalog-td">{formatBDT(item.price)}</td>
                    <td className="admin-catalog-td admin-catalog-td--strong">{formatBDT(item.price * item.qty)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-1.5 border-t border-[rgba(15,23,42,0.06)] pt-4">
            {[['Subtotal', formatBDT(subtotal)], ['Shipping', formatBDT(shipping)]].map(([l, v]) => (
              <div key={l} className="flex justify-between text-[13px] font-semibold text-[var(--admin-text-muted)]">
                <span>{l}</span><span>{v}</span>
              </div>
            ))}
            <div className="flex justify-between text-[15px] font-black text-[var(--admin-text-primary)]">
              <span>Total</span><span className="text-[var(--admin-accent)]">{formatBDT(total)}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <InvoiceActionsBar
            orderId={order.id}
            invoiceNumber={order.invoiceNumber}
            customerPhone={order.shippingPhone}
            hasCourier={Boolean(order.courier?.consignmentId || order.courier?.trackingCode)}
          />

          <SideCard title="Customer" icon={Phone}>
            <p style={{ fontSize: 14, fontWeight: 900, color: 'var(--admin-text-primary)', margin: 0 }}>{order.shippingName}</p>
            <p style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--admin-text-muted)', margin: '6px 0 0' }}>
              <Phone style={{ width: 12, height: 12 }} />{order.shippingPhone}
            </p>
            <button
              type="button"
              className="mt-2.5 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-[10px] border border-[rgba(113,46,255,0.28)] bg-[rgba(113,46,255,0.10)] py-1.5 text-xs font-extrabold text-[var(--admin-c-5b1fd9)]"
              onClick={() => { const p = order.shippingPhone.replace(/\D/g, ''); window.open(`https://wa.me/88${p.startsWith('0') ? p.slice(1) : p}`, '_blank') }}
            >
              <MessageSquare className="h-3.5 w-3.5" /> WhatsApp customer
            </button>
          </SideCard>

          <SideCard title="Shipping" icon={MapPin}>
            <p style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--admin-text-primary)', margin: 0 }}>
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--admin-accent)]" />
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
              <CreditCard className="h-4 w-4 text-[var(--admin-accent)]" />{payment}
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
                <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--admin-warning-ink)', margin: '8px 0 0' }}>
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
