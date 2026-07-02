'use client'

import { useCallback, useState } from 'react'
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
} from 'lucide-react'
import { OrderFulfillmentStepper } from '@/components/orders/OrderFulfillmentStepper'
import { AdminButton } from '@/components/ui/AdminButton'
import { AdminNavLink } from '@/components/layout/AdminNavLink'
import { CourierBadge } from '@/components/ui/CourierBadge'
import { OrderProductThumb } from '@/components/orders/OrderProductThumb'
import {
  downloadInvoice,
  downloadInvoicePdf,
  printInvoice,
} from '@/lib/admin/admin-actions'
import { toastFail, toastOk } from '@/lib/admin/feedback'
import { cn } from '@/lib/utils/cn'

type PreviewTab = 'items' | 'delivery' | 'docs'
type InvoiceAction = 'view' | 'pdf' | 'print' | null

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
  onAdvance?: (nextStatus: string) => void
  advancing?: boolean
  onCancel?: () => void
  onBookCourier?: () => void
  bookingCourier?: boolean
}

function formatBDT(n: number) {
  return `৳${n.toLocaleString('en-BD')}`
}

function orderApiId(order: OrderPreviewData) {
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
  const [tab, setTab] = useState<PreviewTab>('items')
  const [invoiceAction, setInvoiceAction] = useState<InvoiceAction>(null)
  const apiId = orderApiId(order)
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
      setInvoiceAction(action)
      try {
        if (action === 'view') await downloadInvoice(apiId)
        else if (action === 'pdf') await downloadInvoicePdf(apiId, order.id)
        else await printInvoice(apiId)
      } catch {
        toastFail('Invoice request failed — check API connection.')
      } finally {
        setInvoiceAction(null)
      }
    },
    [apiId, order.id],
  )

  const copyInvoiceNumber = () => {
    void navigator.clipboard.writeText(order.id).then(() => {
      toastOk(`Copied ${order.id}`)
    })
  }

  const fullAddress = [order.address, order.district, order.city].filter(Boolean).join(', ')
  const hasCourier = order.courier && order.courier !== '—'
  const statusLabel = formatStatusLabel(order.apiStatus ?? order.status)

  return (
    <>
      <motion.button
        type="button"
        className="admin-order-preview__backdrop"
        aria-label="Close preview"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />
      <motion.div
        className="admin-order-preview"
        role="dialog"
        aria-labelledby="order-preview-title"
        initial={{ opacity: 0, scale: 0.96, x: '-50%', y: '-48%' }}
        animate={{ opacity: 1, scale: 1, x: '-50%', y: '-50%' }}
        exit={{ opacity: 0, scale: 0.98, x: '-50%', y: '-48%' }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
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
            <AdminNavLink
              href={`/dashboard/orders/${apiId}`}
              className="admin-order-preview__icon-btn !p-0"
            >
              <ExternalLink className="h-4 w-4" />
            </AdminNavLink>
            <button type="button" className="admin-order-preview__icon-btn" onClick={onClose} aria-label="Close">
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
                variant="ghost"
                className="admin-order-preview__action admin-order-preview__action--row"
                loading={invoiceAction === 'view'}
                disabled={Boolean(invoiceAction)}
                onClick={() => void runInvoiceAction('view')}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                View invoice
              </AdminButton>
              <AdminButton
                variant="ghost"
                className="admin-order-preview__action admin-order-preview__action--row"
                loading={invoiceAction === 'pdf'}
                disabled={Boolean(invoiceAction)}
                onClick={() => void runInvoiceAction('pdf')}
              >
                <Download className="h-3.5 w-3.5" />
                Download PDF
              </AdminButton>
              <AdminButton
                variant="ghost"
                className="admin-order-preview__action admin-order-preview__action--row"
                loading={invoiceAction === 'print'}
                disabled={Boolean(invoiceAction)}
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
            onAdvance={(nextStatus) => onAdvance?.(nextStatus)}
          />
        </div>

        <div className="admin-order-preview__footer">
          <AdminButton
            variant="ghost"
            className="admin-order-preview__action"
            loading={invoiceAction === 'pdf'}
            disabled={Boolean(invoiceAction)}
            onClick={() => void runInvoiceAction('pdf')}
          >
            <Download className="h-3.5 w-3.5" />
            PDF
          </AdminButton>
          <AdminButton
            variant="ghost"
            className="admin-order-preview__action"
            loading={invoiceAction === 'print'}
            disabled={Boolean(invoiceAction)}
            onClick={() => void runInvoiceAction('print')}
          >
            <Printer className="h-3.5 w-3.5" />
            Print
          </AdminButton>
          <AdminButton
            variant="ghost"
            className="admin-order-preview__action"
            disabled={Boolean(invoiceAction)}
            onClick={copyInvoiceNumber}
          >
            <Copy className="h-3.5 w-3.5" />
            Copy #
          </AdminButton>
          {!hasCourier && onBookCourier ? (
            <AdminButton
              variant="dark"
              className="admin-order-preview__action admin-order-preview__action--courier"
              loading={Boolean(bookingCourier)}
              disabled={Boolean(invoiceAction) || Boolean(bookingCourier)}
              onClick={onBookCourier}
            >
              <Truck className="h-3.5 w-3.5" />
              Book courier
            </AdminButton>
          ) : null}
          {order.status !== 'cancelled' && order.status !== 'delivered' && onCancel ? (
            <AdminButton
              variant="ghost"
              className="admin-order-preview__action admin-order-preview__action--danger"
              disabled={Boolean(invoiceAction)}
              onClick={onCancel}
            >
              Cancel
            </AdminButton>
          ) : null}
        </div>
      </motion.div>
    </>
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
