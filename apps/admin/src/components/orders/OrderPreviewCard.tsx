'use client'

import { useState } from 'react'
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
import { toastOk } from '@/lib/admin/feedback'
import { cn } from '@/lib/utils/cn'

type PreviewTab = 'items' | 'delivery' | 'docs'

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
  items: string
  lineItems?: OrderLineItem[]
  itemCount: number
  total: number
  payment: string
  courier: string
  status: string
  apiStatus?: string
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

  const copyInvoiceNumber = () => {
    void navigator.clipboard.writeText(order.id).then(() => {
      toastOk(`Copied ${order.id}`)
    })
  }

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
            <div className="flex items-center gap-2">
              <GripVertical className="h-4 w-4 text-white/40" aria-hidden />
              <p id="order-preview-title" className="admin-order-preview__title">
                Invoice {order.id}
              </p>
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
            <div className="flex items-start gap-3">
              <CustomerAvatar name={order.customer} />
              <div className="admin-order-preview__customer min-w-0">
                <p className="admin-order-preview__customer-name">{order.customer}</p>
                <span className="admin-order-preview__contact">
                  <Mail className="h-3.5 w-3.5" />
                  {order.payment} · {order.city}
                </span>
                <span className="admin-order-preview__contact">
                  <Phone className="h-3.5 w-3.5" />
                  {order.phone}
                </span>
              </div>
            </div>

            <div className="admin-order-preview__tabs">
              {(['items', 'delivery', 'docs'] as const).map((key) => (
                <button
                  key={key}
                  type="button"
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
                    <div className="flex items-start gap-2.5">
                      <OrderProductThumb
                        src={item.image ?? null}
                        alt={item.name}
                        size="md"
                        className="!ml-0 shrink-0"
                      />
                      <div>
                        <p className="admin-order-preview__item-name">{item.name}</p>
                        <p className="admin-order-preview__item-qty">Qty {item.quantity}</p>
                      </div>
                    </div>
                    <span className="admin-order-preview__item-price">{formatBDT(item.lineTotal)}</span>
                  </div>
                ))}
                <div className="admin-order-preview__item !border-none !pt-3">
                  <p className="admin-order-preview__item-name font-semibold">Total</p>
                  <span className="admin-order-preview__item-price">{formatBDT(order.total)}</span>
                </div>
              </>
            ) : tab === 'delivery' ? (
              <div className="space-y-3">
                <p className="admin-order-preview__contact">
                  <MapPin className="h-3.5 w-3.5" />
                  {order.city}
                </p>
                <p className="admin-order-preview__contact">
                  <Phone className="h-3.5 w-3.5" />
                  {order.phone}
                </p>
                {order.courier && order.courier !== '—' ? (
                  <CourierBadge provider={order.courier} variant="card" />
                ) : (
                  <p className="text-xs text-[#71717a]">No courier assigned yet.</p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-[#71717a]">Premium SPLARO invoice for {order.id}.</p>
                <AdminButton
                  variant="ghost"
                  className="admin-order-preview__action !text-xs w-full justify-start"
                  onClick={() => downloadInvoice(apiId)}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  View invoice
                </AdminButton>
                <AdminButton
                  variant="ghost"
                  className="admin-order-preview__action !text-xs w-full justify-start"
                  onClick={() => downloadInvoicePdf(apiId, order.id)}
                >
                  <Download className="h-3.5 w-3.5" />
                  Download PDF
                </AdminButton>
                <AdminButton
                  variant="ghost"
                  className="admin-order-preview__action !text-xs w-full justify-start"
                  onClick={() => printInvoice(apiId)}
                >
                  <Printer className="h-3.5 w-3.5" />
                  Print invoice
                </AdminButton>
              </div>
            )}
          </div>

          <OrderFulfillmentStepper
            compact
            status={order.apiStatus ?? order.status.toUpperCase()}
            loading={Boolean(advancing)}
            onAdvance={(nextStatus) => onAdvance?.(nextStatus)}
          />

          <div className="admin-order-preview__footer">
            <AdminButton
              variant="ghost"
              className="admin-order-preview__action !text-xs"
              onClick={() => downloadInvoicePdf(apiId, order.id)}
            >
              <Download className="h-3.5 w-3.5" />
              PDF
            </AdminButton>
            <AdminButton
              variant="ghost"
              className="admin-order-preview__action !text-xs"
              onClick={() => printInvoice(apiId)}
            >
              <Printer className="h-3.5 w-3.5" />
              Print
            </AdminButton>
            <AdminButton
              variant="ghost"
              className="admin-order-preview__action !text-xs"
              onClick={copyInvoiceNumber}
            >
              <Copy className="h-3.5 w-3.5" />
              Copy #
            </AdminButton>
            {order.courier === '—' && onBookCourier ? (
              <AdminButton
                variant="ghost"
                className="admin-order-preview__action !text-xs"
                loading={Boolean(bookingCourier)}
                onClick={onBookCourier}
              >
                Book courier
              </AdminButton>
            ) : null}
            {order.status !== 'cancelled' && order.status !== 'delivered' && onCancel ? (
              <AdminButton variant="ghost" className="admin-order-preview__action !text-xs" onClick={onCancel}>
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
