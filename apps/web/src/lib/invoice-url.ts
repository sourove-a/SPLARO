import {
  displayOrderCode,
  isSplOrderCode,
  looksLikeInternalOrderId,
} from '@splaro/config'
import type { StoredOrder } from '@/lib/orders'

type InvoiceOrderRef = Pick<StoredOrder, 'id' | 'invoiceNumber' | 'invoiceAccessKey'>

/** Customer-facing label — never a raw CUID. */
export function orderPublicLabel(order: InvoiceOrderRef): string {
  return displayOrderCode(order.invoiceNumber, order.id)
}

/**
 * URL slug for confirmation / invoice routes.
 * Prefer SPL-####; fall back to internal id for lookup only (not for display).
 */
export function orderPublicRef(order: InvoiceOrderRef): string {
  const code = order.invoiceNumber?.trim()
  if (code && isSplOrderCode(code)) return code.toUpperCase()
  if (code && !looksLikeInternalOrderId(code)) return code
  return order.id
}

export function buildInvoiceUrl(order: InvoiceOrderRef): string {
  const slug = encodeURIComponent(orderPublicRef(order))
  const key = order.invoiceAccessKey?.trim()
  const qs = key ? `?key=${encodeURIComponent(key)}` : ''
  return `/api/orders/${slug}/invoice${qs}`
}

export function buildOrderConfirmationPath(order: InvoiceOrderRef): string {
  const slug = encodeURIComponent(orderPublicRef(order))
  const key = order.invoiceAccessKey?.trim()
  return `/order-confirmation/${slug}${key ? `?key=${encodeURIComponent(key)}` : ''}`
}
