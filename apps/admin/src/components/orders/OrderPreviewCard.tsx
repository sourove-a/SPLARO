'use client'

import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  X,
  ExternalLink,
  Mail,
  Phone,
  MapPin,
  Printer,
  Download,
  Copy,
  GripVertical,
  Truck,
  Hash,
  Tag,
} from 'lucide-react'
import { OrderFulfillmentStepper } from '@/components/orders/OrderFulfillmentStepper'
import { AdminButton } from '@/components/ui/AdminButton'
import { CourierBadge } from '@/components/ui/CourierBadge'
import { OrderProductThumb } from '@/components/orders/OrderProductThumb'
import {
  downloadInvoice,
  downloadInvoicePdf,
  printInvoice,
  printOrderLabel,
  printOrderSticker,
} from '@/lib/admin/admin-actions'
import { toastFail, toastWarn, toastInfo } from '@/lib/admin/feedback'
import { cancelCourierBookingLocal, trackCourierParcel } from '@/lib/api/fulfillment'
import { copyWithToast } from '@/lib/admin/clipboard'
import { cn } from '@/lib/utils/cn'

type PreviewTab = 'items' | 'delivery' | 'docs'
type InvoiceAction = 'view' | 'pdf' | 'print' | 'label' | 'sticker' | 'track' | 'cancel-booking' | null

interface OrderLineItem {
  name: string
  quantity: number
  lineTotal: number
  image?: string | null
}

interface OrderPreviewData {
  id: string
  linkId?: string
  customer: string
  phone: string
  city: string
  address?: string
  district?: string
  items: string
  lineItems?: OrderLineItem[]
  itemCount: number
  total: number
  payment: string
  courier: string
  trackingCode?: string | null
  consignmentId?: string | null
  courierStatus?: string
  paymentStatus?: string
  status: string
  apiStatus?: string
  createdAt?: string
}

interface OrderPreviewCardProps {
  order: OrderPreviewData
  onClose: () => void
  onAdvance?: (nextStatus: string, note?: string) => void
  advancing?: boolean
  onCancel?: () => void
  onBookCourier?: () => void
  bookingCourier?: boolean
}

function formatBDT(n: number) {
  return `৳${n.toLocaleString('en-BD')}`
}

/** Internal DB id (cuid) — status / courier mutations */
function orderApiId(order: OrderPreviewData) {
  return order.linkId ?? order.id
}

/**
 * Human invoice ref for print/PDF URLs (e.g. SPL-1002).
 * API resolves by invoiceNumber OR cuid — prefer readable number in the address bar.
 */
function orderInvoiceRef(order: OrderPreviewData) {
  const invoice = order.id?.trim()
  if (invoice && /^SPL[-_]?\d+/i.test(invoice)) return invoice
  return order.linkId ?? order.id
}

function formatStatusLabel(status: string) {
  return status.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase())
}

function shortRef(id?: string) {
  if (!id || id.length < 12) return null
  return id.slice(0, 8)
}

export function OrderPreviewCard({
  order,
  onClose,
  onAdvance,
  advancing,
  onCancel,
  onBookCourier,
  bookingCourier,
}: OrderPreviewCardProps) {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [tab, setTab] = useState<PreviewTab>('items')
  const [invoiceAction, setInvoiceAction] = useState<InvoiceAction>(null)
  const actionBusyRef = useRef(false)
  const apiId = orderApiId(order)
  const invoiceRef = orderInvoiceRef(order)

  useEffect(() => {
    setMounted(true)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const openFullOrder = (event: MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    onClose()
    router.push(`/dashboard/orders/${apiId}`)
  }

  const handleClose = (event: MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    onClose()
  }
  const parsedLines = order.items.split(',').map((s) => s.trim()).filter(Boolean)
  const displayItems: OrderLineItem[] =
    order.lineItems?.length
      ? order.lineItems
      : (parsedLines.length ? parsedLines : [order.items]).map((line) => {
          const qtyMatch = line.match(/×(\d+)$/)
          return {
            name: line.replace(/ ×\d+$/, ''),
            quantity: qtyMatch ? Number(qtyMatch[1]) : order.itemCount,
            lineTotal: order.total / Math.max(parsedLines.length || 1, 1),
            image: null,
          }
        })

  const runInvoiceAction = useCallback(
    async (action: Exclude<InvoiceAction, null>) => {
      // Never blanket-disable sibling buttons — only skip if this dialog is already busy.
      if (actionBusyRef.current) return
      actionBusyRef.current = true
      setInvoiceAction(action)
      try {
        if (action === 'view') await downloadInvoice(invoiceRef)
        else if (action === 'pdf') await downloadInvoicePdf(invoiceRef, order.id)
        else if (action === 'print') await printInvoice(invoiceRef)
        else if (action === 'label') await printOrderLabel(invoiceRef)
        else if (action === 'sticker') await printOrderSticker(invoiceRef)
        else if (action === 'track') {
          const track = await trackCourierParcel(apiId)
          if (!track.status && !track.trackingCode) {
            toastFail('No courier tracking yet — book courier first.')
          } else {
            const bits = [
              track.provider,
              track.status,
              track.trackingCode ? `Track ${track.trackingCode}` : null,
            ].filter(Boolean)
            toastInfo(bits.join(' · ') || 'Tracking fetched')
            if (track.trackingUrl) {
              window.open(track.trackingUrl, '_blank', 'noopener,noreferrer')
            }
          }
        } else if (action === 'cancel-booking') {
          const res = await cancelCourierBookingLocal(apiId)
          toastWarn(res.message, `cancel-booking-${apiId}`)
        }
      } catch {
        toastFail(
          action === 'track' || action === 'cancel-booking'
            ? 'Courier action failed — check API connection.'
            : 'Invoice / label request failed — check API connection.',
        )
      } finally {
        actionBusyRef.current = false
        setInvoiceAction(null)
      }
    },
    [invoiceRef, order.id, apiId],
  )

  const copyInvoiceNumber = () => {
    void copyWithToast(order.id, `Copied ${order.id}`)
  }

  const fullAddress = [order.address, order.district, order.city].filter(Boolean).join(', ')
  const hasCourier = order.courier && order.courier !== '—'
  const statusLabel = formatStatusLabel(order.apiStatus ?? order.status)

  if (!mounted) return null

  return createPortal(
    <motion.div
      className="admin-order-preview-root"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
    >
      <button
        type="button"
        className="admin-order-preview__backdrop"
        aria-label="Close preview"
        onClick={handleClose}
      />
      <div
        className="admin-order-preview"
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-preview-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="admin-order-preview__header">
          <div className="admin-order-preview__header-main">
            <GripVertical className="admin-order-preview__grip" aria-hidden />
            <div className="min-w-0">
              <p id="order-preview-title" className="admin-order-preview__title">
                Invoice {order.id}
              </p>
              {shortRef(order.linkId) ? (
                <p className="admin-order-preview__ref">Ref {shortRef(order.linkId)}</p>
              ) : null}
            </div>
            <span className={cn('admin-order-preview__status', `admin-order-preview__status--${order.status}`)}>
              {statusLabel}
            </span>
          </div>
          <div className="admin-order-preview__header-actions">
            <button
              type="button"
              className="admin-order-preview__icon-btn"
              onClick={openFullOrder}
              aria-label="Open full order"
              title="Open full order"
            >
              <ExternalLink className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="admin-order-preview__icon-btn"
              onClick={handleClose}
              aria-label="Close"
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="admin-order-preview__meta">
          <div className="admin-order-preview__customer-row">
            <CustomerAvatar name={order.customer} />
            <div className="admin-order-preview__customer min-w-0">
              <p className="admin-order-preview__customer-name">{order.customer}</p>
              <span className="admin-order-preview__contact">
                <Mail className="h-3.5 w-3.5 shrink-0" />
                {order.payment}
                {order.paymentStatus ? ` · ${formatStatusLabel(order.paymentStatus)}` : ''}
                {order.city ? ` · ${order.city}` : ''}
              </span>
              <span className="admin-order-preview__contact">
                <Phone className="h-3.5 w-3.5 shrink-0" />
                {order.phone}
              </span>
            </div>
            <p className="admin-order-preview__total">{formatBDT(order.total)}</p>
          </div>

          <div className="admin-order-preview__tabs" role="tablist" aria-label="Order preview sections">
            {(['items', 'delivery', 'docs'] as const).map((key) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                className={cn('admin-order-preview__tab', tab === key && 'admin-order-preview__tab--active')}
                onClick={() => setTab(key)}
              >
                {key === 'items' ? 'Order items' : key === 'delivery' ? 'Delivery' : 'Invoice'}
              </button>
            ))}
          </div>
        </div>

        <div className="admin-order-preview__body">
          {tab === 'items' ? (
            <>
              {displayItems.map((item, i) => (
                <div key={`${item.name}-${i}`} className="admin-order-preview__item">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <OrderProductThumb
                      src={item.image ?? null}
                      alt={item.name}
                      size="md"
                      className="!ml-0 shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="admin-order-preview__item-name">{item.name}</p>
                      <p className="admin-order-preview__item-qty">Qty {item.quantity}</p>
                    </div>
                  </div>
                  <span className="admin-order-preview__item-price">{formatBDT(item.lineTotal)}</span>
                </div>
              ))}
              <div className="admin-order-preview__total-row">
                <p className="admin-order-preview__item-name">Total</p>
                <span className="admin-order-preview__item-price">{formatBDT(order.total)}</span>
              </div>
            </>
          ) : tab === 'delivery' ? (
            <div className="admin-order-preview__delivery">
              <div className="admin-order-preview__panel">
                <p className="admin-order-preview__panel-label">Ship to</p>
                <p className="admin-order-preview__panel-value">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  {fullAddress || order.city || '—'}
                </p>
                <p className="admin-order-preview__panel-sub">
                  <Phone className="h-3.5 w-3.5 shrink-0" />
                  {order.phone}
                </p>
              </div>

              <div className="admin-order-preview__panel">
                <p className="admin-order-preview__panel-label">Courier</p>
                {hasCourier ? (
                  <>
                    <CourierBadge provider={order.courier} variant="card" />
                    {order.consignmentId ? (
                      <p className="admin-order-preview__panel-sub">
                        <Hash className="h-3.5 w-3.5 shrink-0" />
                        {order.consignmentId}
                      </p>
                    ) : null}
                    {order.trackingCode ? (
                      <p className="admin-order-preview__panel-sub">
                        <Truck className="h-3.5 w-3.5 shrink-0" />
                        {order.trackingCode}
                      </p>
                    ) : null}
                    {order.courierStatus ? (
                      <p className="admin-order-preview__panel-meta">{formatStatusLabel(order.courierStatus)}</p>
                    ) : null}
                  </>
                ) : (
                  <p className="admin-order-preview__panel-empty">No courier assigned yet.</p>
                )}
              </div>
            </div>
          ) : (
            <div className="admin-order-preview__docs">
              <p className="admin-order-preview__docs-lead">Premium SPLARO invoice for {order.id}.</p>
              <AdminButton
                variant="secondary"
                className="admin-order-preview__action admin-order-preview__action--row"
                loading={invoiceAction === 'view'}
                onClick={() => void runInvoiceAction('view')}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                View invoice
              </AdminButton>
              <AdminButton
                variant="secondary"
                className="admin-order-preview__action admin-order-preview__action--row"
                loading={invoiceAction === 'pdf'}
                onClick={() => void runInvoiceAction('pdf')}
              >
                <Download className="h-3.5 w-3.5" />
                Download PDF
              </AdminButton>
              <AdminButton
                variant="secondary"
                className="admin-order-preview__action admin-order-preview__action--row"
                loading={invoiceAction === 'print'}
                onClick={() => void runInvoiceAction('print')}
              >
                <Printer className="h-3.5 w-3.5" />
                Print invoice
              </AdminButton>
            </div>
          )}
        </div>

        <div className="admin-order-preview__fulfillment">
          <OrderFulfillmentStepper
            compact
            status={order.apiStatus ?? order.status.toUpperCase()}
            loading={Boolean(advancing)}
            onAdvance={(nextStatus, note) => onAdvance?.(nextStatus, note)}
          />
        </div>

        <div className="admin-order-preview__footer">
          <p className="admin-order-preview__footer-label">Documents & actions</p>
          <div className="admin-order-preview__tools">
            <AdminButton
              variant="secondary"
              size="sm"
              className="admin-order-preview__tool"
              loading={invoiceAction === 'pdf'}
              onClick={() => void runInvoiceAction('pdf')}
            >
              <Download className="h-3.5 w-3.5" />
              PDF
            </AdminButton>
            <AdminButton
              variant="secondary"
              size="sm"
              className="admin-order-preview__tool"
              loading={invoiceAction === 'print'}
              onClick={() => void runInvoiceAction('print')}
            >
              <Printer className="h-3.5 w-3.5" />
              Print
            </AdminButton>
            <AdminButton
              variant="secondary"
              size="sm"
              className="admin-order-preview__tool"
              loading={invoiceAction === 'label'}
              onClick={() => void runInvoiceAction('label')}
            >
              <Printer className="h-3.5 w-3.5" />
              Label
            </AdminButton>
            <AdminButton
              variant="secondary"
              size="sm"
              className="admin-order-preview__tool"
              loading={invoiceAction === 'sticker'}
              onClick={() => void runInvoiceAction('sticker')}
            >
              <Tag className="h-3.5 w-3.5" />
              Sticker
            </AdminButton>
          </div>

          <div className="admin-order-preview__footer-row">
            <AdminButton
              variant="ghost"
              size="sm"
              className="admin-order-preview__tool admin-order-preview__tool--ghost"
              onClick={copyInvoiceNumber}
            >
              <Copy className="h-3.5 w-3.5" />
              Copy #
            </AdminButton>
            {hasCourier ? (
              <AdminButton
                variant="ghost"
                size="sm"
                className="admin-order-preview__tool admin-order-preview__tool--ghost"
                loading={invoiceAction === 'track'}
                onClick={() => void runInvoiceAction('track')}
              >
                <Truck className="h-3.5 w-3.5" />
                Track
              </AdminButton>
            ) : null}
          </div>

          {!hasCourier && onBookCourier ? (
            <AdminButton
              variant="gold"
              className="admin-order-preview__action--courier"
              loading={Boolean(bookingCourier)}
              onClick={onBookCourier}
            >
              <Truck className="h-3.5 w-3.5" />
              Book courier
            </AdminButton>
          ) : null}

          {hasCourier ? (
            <AdminButton
              variant="danger"
              size="sm"
              className="admin-order-preview__action--danger-full"
              loading={invoiceAction === 'cancel-booking'}
              onClick={() => void runInvoiceAction('cancel-booking')}
            >
              Cancel booking
            </AdminButton>
          ) : null}

          {order.status !== 'cancelled' && order.status !== 'delivered' && onCancel ? (
            <AdminButton
              variant="ghost"
              size="sm"
              className="admin-order-preview__tool admin-order-preview__tool--cancel"
              onClick={onCancel}
            >
              Cancel order
            </AdminButton>
          ) : null}
        </div>
      </div>
    </motion.div>,
    document.body,
  )
}

function customerInitials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

export function CustomerAvatar({ name }: { name: string }) {
  return <span className="admin-avatar">{customerInitials(name) || '?'}</span>
}
