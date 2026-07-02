'use client'

import {
  toastOk,
  toastFail,
  toastCourierResult,
  refreshWithToast,
} from '@/lib/admin/feedback'
import {
  ArrowLeft, MapPin, Phone, CreditCard, Truck,
  MessageSquare, RefreshCw, XCircle, Trash2,
} from 'lucide-react'
import { AdminButton, AdminLinkButton } from '@/components/ui/AdminButton'
import { OrdersPanel } from '@/components/modules/OrdersPanel'
import { OrderFulfillmentStepper } from '@/components/orders/OrderFulfillmentStepper'
import { OrderCreatePanel } from '@/components/modules/OrderCreatePanel'
import { InvoiceActionsBar } from '@/components/modules/InvoiceActionsBar'
import { useOrder, useUpdateOrderStatus, useDeleteOrder, useBookCourier } from '@/lib/api/hooks'
import { useInfrastructureConfig } from '@/lib/api/integration-hooks'
import { mapPaymentMethod, mapOrderStatus } from '@/lib/api/orders'
import type { ModuleContextProps } from '@/lib/modules/module-data'
import { formatBDT } from '@/lib/utils/currency'

// ─── Design tokens ──────────────────────────────────────────────────────────
const GOLD = '#C8A97E'
const GOLD_LIGHT = 'rgba(200,169,126,0.10)'
const GOLD_BORDER = 'rgba(200,169,126,0.32)'


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

export function OrderDetailPanel({ recordId, moduleHref }: { recordId: string; moduleHref: string }) {
  const { data: order, isLoading, isError, refetch } = useOrder(recordId)
  const { data: steadfast } = useInfrastructureConfig('steadfast')
  const updateStatus = useUpdateOrderStatus()
  const deleteOrderMutation = useDeleteOrder()
  const bookCourier = useBookCourier()
  const courierReady = Boolean(steadfast?.configured)

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
              <StatusPill value={status} />
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <AdminButton onClick={() => { void refreshWithToast(() => refetch(), 'Order refreshed.') }}><RefreshCw style={{ width: 16, height: 16 }} /> Refresh</AdminButton>
              {order.status !== 'CANCELLED' && order.status !== 'DELIVERED' ? (
                <AdminButton variant="ghost" loading={updateStatus.isPending} className="!text-amber-800 hover:!bg-amber-50" onClick={() => { if (!window.confirm(`Cancel order ${order.invoiceNumber}?`)) return; updateStatus.mutate({ id: order.id, status: 'CANCELLED', note: 'Cancelled from admin panel' }, { onSuccess: () => { toastOk('Order cancelled.'); void refetch() }, onError: (err) => toastFail(err instanceof Error ? err.message : 'Could not cancel order.') }) }}>
                  <XCircle style={{ width: 16, height: 16 }} /> Cancel
                </AdminButton>
              ) : null}
              <AdminButton variant="ghost" loading={deleteOrderMutation.isPending} className="!text-red-700 hover:!bg-red-50" onClick={() => { if (!window.confirm(`Delete order ${order.invoiceNumber}? This cannot be undone.`)) return; deleteOrderMutation.mutate(order.id, { onSuccess: () => { toastOk('Order deleted.'); window.location.href = moduleHref }, onError: (err) => toastFail(err instanceof Error ? err.message : 'Could not delete order.') }) }}>
                <Trash2 style={{ width: 16, height: 16 }} /> Delete
              </AdminButton>
            </div>
          </div>

          <OrderFulfillmentStepper
            status={order.status}
            loading={updateStatus.isPending}
            onAdvance={(nextStatus, note) =>
              updateStatus.mutate(
                { id: order.id, status: nextStatus, note },
                {
                  onSuccess: () => {
                    toastOk('Order updated.')
                    void refetch()
                  },
                  onError: () => toastFail('Could not update order status.'),
                },
              )
            }
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
                  className="mt-3 w-full !text-xs"
                  disabled={!courierReady}
                  loading={bookCourier.isPending}
                  onClick={() => bookCourier.mutate({ id: order.id }, { onSuccess: (res) => { toastCourierResult(res, order.invoiceNumber); if (res.success && !res.simulated && res.consignmentId && !res.consignmentId.startsWith('DEV-')) void refetch() }, onError: () => toastFail('Could not book courier — is the API running?') })}
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
            <p style={{ fontSize: 12, color: 'var(--admin-text-muted)', margin: '4px 0 0' }}>Status: {order.paymentStatus}</p>
          </SideCard>

          {order.internalNotes?.length ? (
            <SideCard title="Internal notes" icon={MessageSquare}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {order.internalNotes.map((note) => (
                  <div key={note.id} className="settings-card admin-panel-glass-subtle" style={{ padding: '8px 12px', fontSize: 12, fontWeight: 600, color: 'var(--admin-text-primary)' }}>{note.body}</div>
                ))}
              </div>
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
