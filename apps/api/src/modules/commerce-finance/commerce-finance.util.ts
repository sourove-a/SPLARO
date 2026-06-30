import { PaymentMethod, PaymentStatus, RMAStatus, RMAType } from '@prisma/client'
import type { InvoiceUiStatus, RmaUiStatus, TransactionUiStatus, TransactionUiType } from './commerce-finance.types'

const GATEWAY_LABELS: Record<PaymentMethod, string> = {
  CASH_ON_DELIVERY: 'COD',
  BKASH: 'bKash',
  NAGAD: 'Nagad',
  SSLCOMMERZ: 'SSLCommerz',
  CARD: 'Card',
  BANK_TRANSFER: 'Bank',
}

export function gatewayLabel(method: PaymentMethod): string {
  return GATEWAY_LABELS[method] ?? method
}

export function mapPaymentStatus(status: PaymentStatus): TransactionUiStatus {
  if (status === PaymentStatus.PAID) return 'success'
  if (status === PaymentStatus.FAILED) return 'failed'
  return 'pending'
}

export function mapPaymentType(status: PaymentStatus, refundedAt: Date | null): TransactionUiType {
  if (status === PaymentStatus.REFUNDED || status === PaymentStatus.PARTIALLY_REFUNDED || refundedAt) {
    return 'refund'
  }
  return 'payment'
}

export function mapInvoiceStatus(paymentStatus: PaymentStatus, createdAt: Date): InvoiceUiStatus {
  if (paymentStatus === PaymentStatus.PAID) return 'paid'
  const daysOld = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24)
  if (daysOld > 14 && paymentStatus === PaymentStatus.UNPAID) return 'overdue'
  if (paymentStatus === PaymentStatus.PENDING) return 'sent'
  return 'draft'
}

export function mapRmaStatus(status: RMAStatus): RmaUiStatus {
  switch (status) {
    case 'REQUESTED':
      return 'pending'
    case 'APPROVED':
      return 'approved'
    case 'ITEM_RECEIVED':
      return 'received'
    case 'REFUNDED':
    case 'PROCESSED':
    case 'EXCHANGED':
    case 'CLOSED':
      return 'refunded'
    case 'REJECTED':
      return 'rejected'
    default:
      return 'pending'
  }
}

export function mapRmaMethod(type: RMAType): 'Refund' | 'Exchange' | 'Store credit' {
  if (type === 'EXCHANGE') return 'Exchange'
  if (type === 'REPAIR') return 'Store credit'
  return 'Refund'
}

export function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10)
}
