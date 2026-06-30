export type InvoiceUiStatus = 'draft' | 'sent' | 'paid' | 'overdue'

export interface InvoiceListRow {
  id: string
  invoiceNumber: string
  orderId: string
  customer: string
  amount: number
  status: InvoiceUiStatus
  issued: string
  due: string
}

export type TransactionUiStatus = 'success' | 'pending' | 'failed'
export type TransactionUiType = 'payment' | 'refund' | 'payout'

export interface TransactionListRow {
  id: string
  orderId: string
  orderNumber: string
  gateway: string
  type: TransactionUiType
  amount: number
  status: TransactionUiStatus
  ref: string
  time: string
}

export type RmaUiStatus = 'pending' | 'approved' | 'received' | 'refunded' | 'rejected'

export interface RmaListRow {
  id: string
  rmaNumber: string
  orderId: string
  orderNumber: string
  customer: string
  reason: string
  items: string
  amount: number
  method: 'Refund' | 'Exchange' | 'Store credit'
  status: RmaUiStatus
  updated: string
}

export interface TransactionStats {
  volume: number
  successRate: number
  pending: number
  failed: number
}
