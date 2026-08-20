'use client'

import { useState, useEffect } from 'react'
import { formatCleanAddress, displaySizeLabel } from '@splaro/config'
import {
  toastFail,
  toastOk,
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
import { OrderFulfillmentStepper } from '@/components/orders/OrderFulfillmentStepper'
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
import { formatBDT } from '@/lib/utils/currency'
import { formatBdPhone, whatsappHref } from '@/lib/format/bd-phone'
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
    <section
      className="dc-order-side-card"
      style={{
        margin: 0,
        padding: 16,
        border: '1px solid var(--line)',
        borderRadius: 14,
        background: 'var(--surface)',
        backgroundImage: 'var(--card-sheen)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            borderRadius: 8,
            border: '1px solid var(--line)',
            background: 'var(--surface-2)',
            color: 'var(--violet)',
          }}
        >
          <Icon style={{ width: 14, height: 14 }} />
        </span>
        <p
          style={{
            margin: 0,
            font: '600 10.5px/1 var(--dc-font, inherit)',
            letterSpacing: '0.09em',
            textTransform: 'uppercase',
            color: 'var(--ink-3)',
          }}
        >
          {title}
        </p>
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

  const items = order.items?.map((item, index) => ({
    // Two lines can carry the same product name (same SKU split across sizes,
    // or a re-add), so the row key comes from the line id, never the name.
    key: item.id || `line-${index}`,
    name: `${item.product?.name ?? item.productName ?? 'Item'}${item.variant?.size ? ` · ${displaySizeLabel(item.variant.size)}` : ''}`,
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
    if (
      !window.confirm(
        `Cancel ${order.invoiceNumber}? It stays on file as CANCELLED and the number will not be reused.`,
      )
    ) {
      return
    }
    try {
      const result = await deleteOrderMutation.mutateAsync(order.id)
      if (!verifyDeleteSuccess(result)) return
      toastOk(`${order.invoiceNumber} cancelled — number retired`)
      void refetch()
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'Could not cancel order.')
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

  const persistCodRisk = async (isCodRisk: boolean, advance: boolean) => {
    try {
      const saved = await setCodRisk.mutateAsync({
        id: order.id,
        isCodRisk,
        requireAdvancePayment: isCodRisk ? advance : false,
      })
      if (!verifyCodRisk(saved, isCodRisk)) return
      toastApiSaved(`Order ${order.invoiceNumber} COD risk`)
      void refetch()
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'Could not update COD risk flag.')
    }
  }

  const handleCodRiskToggle = () => persistCodRisk(!order.isCodRisk, requireAdvance)

  const handleRequireAdvanceChange = (checked: boolean) => {
    setRequireAdvance(checked)
    // Once the order is flagged, this checkbox is the only control for the
    // field — the button below it clears the flag rather than saving it, so
    // the change has to persist here or it silently does nothing.
    if (order.isCodRisk) void persistCodRisk(true, checked)
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
    <div className="dc-order-detail-body mx-auto max-w-[960px]" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 280px', gap: 14, alignItems: 'start' }} className="dc-order-detail-grid">
        <div
          className="dc-order-hero"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            padding: 16,
            border: '1px solid var(--line)',
            borderRadius: 14,
            background: 'var(--surface)',
            backgroundImage: 'var(--card-sheen)',
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <h2
                style={{
                  margin: '0 0 8px',
                  font: '700 17px/1.2 var(--dc-mono, ui-monospace, monospace)',
                  color: 'var(--ink)',
                }}
              >
                {order.invoiceNumber}
              </h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                <StatusPill value={status} />
                {order.isCodRisk ? (
                  <AdminStatusBadge label="COD risk" tone="warning" />
                ) : null}
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {canEditOrders && order.status === 'PENDING' ? (
                <AdminButton
                  variant="accent"
                  loading={updateStatus.isPending}
                  onClick={() => void handleAdvanceStatus('CONFIRMED', 'Confirmed from order detail')}
                >
                  Confirm order
                </AdminButton>
              ) : null}
              {canEditOrders && !order.courier?.consignmentId && order.status !== 'CANCELLED' ? (
                <AdminButton
                  variant="accent"
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

          <div style={{ border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Product', 'Qty', 'Price', 'Subtotal'].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: 'left',
                        padding: '9px 14px',
                        font: '600 10.5px/1 var(--dc-font, inherit)',
                        letterSpacing: '0.09em',
                        textTransform: 'uppercase',
                        color: 'var(--ink-3)',
                        borderBottom: '1px solid var(--line)',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: '14px', fontSize: 12, fontWeight: 600, color: 'var(--ink-3)' }}>
                      No line items on this order.
                    </td>
                  </tr>
                ) : null}
                {items.map((item) => (
                  <tr key={item.key}>
                    <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--ink)', borderBottom: '1px solid var(--line)' }}>{item.name}</td>
                    <td style={{ padding: '10px 14px', color: 'var(--ink-2)', borderBottom: '1px solid var(--line)', fontFamily: 'var(--dc-mono, ui-monospace, monospace)' }}>{item.qty}</td>
                    <td style={{ padding: '10px 14px', color: 'var(--ink-2)', borderBottom: '1px solid var(--line)', fontFamily: 'var(--dc-mono, ui-monospace, monospace)' }}>{formatBDT(item.price)}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--ink)', borderBottom: '1px solid var(--line)', fontFamily: 'var(--dc-mono, ui-monospace, monospace)' }}>{formatBDT(item.price * item.qty)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, borderTop: '1px solid var(--line)', paddingTop: 14 }}>
            {([['Subtotal', formatBDT(subtotal)], ['Shipping', formatBDT(shipping)]] as const).map(([l, v]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600, color: 'var(--ink-3)' }}>
                <span>{l}</span><span>{v}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 800, color: 'var(--ink)' }}>
              <span>Total</span><span style={{ color: 'var(--violet)' }}>{formatBDT(total)}</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <InvoiceActionsBar
            orderId={order.id}
            invoiceNumber={order.invoiceNumber}
            customerPhone={order.shippingPhone}
            hasCourier={Boolean(order.courier?.consignmentId || order.courier?.trackingCode)}
          />

          <SideCard title="Customer" icon={Phone}>
            <p style={{ fontSize: 14, fontWeight: 800, color: 'var(--ink)', margin: 0 }}>{order.shippingName}</p>
            <p style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--ink-3)', margin: '6px 0 0' }}>
              <Phone style={{ width: 12, height: 12 }} />{formatBdPhone(order.shippingPhone)}
            </p>
            <button
              type="button"
              className="mt-2.5 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-[10px] border border-[var(--violet-bd)] bg-[var(--violet-soft)] py-1.5 text-xs font-extrabold text-[var(--violet)]"
              onClick={() => window.open(whatsappHref(order.shippingPhone), '_blank', 'noopener,noreferrer')}
            >
              <MessageSquare className="h-3.5 w-3.5" /> WhatsApp customer
            </button>
          </SideCard>

          <SideCard title="Shipping" icon={MapPin}>
            <p style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--ink)', margin: 0 }}>
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--violet)]" />
              {formatCleanAddress(order.shippingAddress, order.shippingCity, order.shippingDistrict)}
            </p>
            <p style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--ink-3)', margin: '8px 0 0' }}>
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
                  variant="accent"
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
            <p style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--ink)', margin: 0 }}>
              <CreditCard className="h-4 w-4 text-[var(--violet)]" />{payment}
            </p>
            {canEditOrders ? (
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 10, fontWeight: 800, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Payment status
                </label>
                <select
                  value={order.paymentStatus}
                  disabled={updatePayment.isPending}
                  onChange={(e) => void handlePaymentStatusChange(e.target.value as OrderPaymentStatus)}
                  style={{
                    width: '100%',
                    borderRadius: 9,
                    border: '1px solid var(--line)',
                    background: 'var(--surface-2)',
                    padding: '8px 10px',
                    fontSize: 12,
                    fontWeight: 700,
                    color: 'var(--ink)',
                  }}
                >
                  {PAYMENT_STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            ) : (
              <p style={{ fontSize: 12, color: 'var(--ink-3)', margin: '4px 0 0' }}>Status: {order.paymentStatus}</p>
            )}
          </SideCard>

          {(order.paymentMethod === 'CASH_ON_DELIVERY' || order.isCodRisk) && canEditOrders ? (
            <SideCard title="COD risk" icon={AlertTriangle}>
              <p style={{ fontSize: 12, color: 'var(--ink-3)', margin: '0 0 10px' }}>
                Flag high-risk COD orders and optionally require advance payment before fulfillment.
              </p>
              {order.customer?.codRiskScore !== undefined ? (
                <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', margin: '0 0 10px' }}>
                  Customer COD score: {order.customer.codRiskScore}/100
                </p>
              ) : null}
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 10 }}>
                <input
                  type="checkbox"
                  checked={requireAdvance}
                  onChange={(e) => handleRequireAdvanceChange(e.target.checked)}
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
                <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--warn)', margin: '8px 0 0' }}>
                  Advance payment required on this order
                </p>
              ) : null}
            </SideCard>
          ) : null}

          <SideCard title="Internal notes" icon={MessageSquare}>
            {order.internalNotes?.length ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: canEditOrders ? 12 : 0 }}>
                {order.internalNotes.map((note) => (
                  <div key={note.id} style={{ padding: '8px 12px', fontSize: 12, fontWeight: 600, color: 'var(--ink)', border: '1px solid var(--line)', borderRadius: 10, background: 'var(--surface-2)' }}>
                    {note.body}
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: 12, color: 'var(--ink-3)', margin: canEditOrders ? '0 0 12px' : 0 }}>
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
                    borderRadius: 9,
                    border: '1px solid var(--line)',
                    background: 'var(--surface-2)',
                    padding: '8px 10px',
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--ink)',
                    resize: 'vertical',
                  }}
                />
                <AdminButton
                  size="sm"
                  variant="accent"
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
              <p style={{ fontSize: 12, color: 'var(--ink-3)', margin: '0 0 10px' }}>
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
                      borderRadius: 9,
                      border: '1px solid var(--line)',
                      background: 'var(--surface-2)',
                      padding: '8px 10px',
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'var(--ink)',
                    }}
                  />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <AdminButton
                      variant="accent"
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
                  <AdminButton size="sm" variant="accent" onClick={() => setShowReturnForm(true)}>
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
      <style>{`
        @media (max-width: 900px) {
          .dc-order-detail-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}