import { displayOrderCode } from '@splaro/config'
import type { StoredOrder } from '@/lib/orders'

type InvoiceOrderRef = Pick<StoredOrder, 'id' | 'invoiceNumber' | 'invoiceAccessKey'>

export function orderPublicRef(order: InvoiceOrderRef): string {
  return displayOrderCode(order.invoiceNumber, order.id)
}

export function buildInvoiceUrl(order: InvoiceOrderRef): string {
  const slug = encodeURIComponent(orderPublicRef(order))
  const key = order.invoiceAccessKey?.trim()
  const qs = key ? `?key=${encodeURIComponent(key)}` : ''
  return `/api/orders/${slug}/invoice${qs}`
}

export function buildOrderConfirmationPath(order: InvoiceOrderRef): string {
  return `/order-confirmation/${encodeURIComponent(orderPublicRef(order))}`
}
