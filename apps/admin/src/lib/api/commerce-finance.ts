import { apiFetch } from './client'

export interface ApiInvoiceRow {
  id: string
  invoiceNumber: string
  orderId: string
  customer: string
  amount: number
  status: 'draft' | 'sent' | 'paid' | 'overdue'
  issued: string
  due: string
}

export interface ApiTransactionRow {
  id: string
  orderId: string
  orderNumber: string
  gateway: string
  type: 'payment' | 'refund' | 'payout'
  amount: number
  status: 'success' | 'pending' | 'failed'
  ref: string
  time: string
}

export interface ApiRmaRow {
  id: string
  rmaNumber: string
  orderId: string
  orderNumber: string
  customer: string
  reason: string
  items: string
  amount: number
  method: 'Refund' | 'Exchange' | 'Store credit'
  status: 'pending' | 'approved' | 'received' | 'refunded' | 'rejected'
  updated: string
}

export function fetchInvoices(search?: string) {
  const qs = search ? `?search=${encodeURIComponent(search)}` : ''
  return apiFetch<ApiInvoiceRow[]>(`/admin/commerce-finance/invoices${qs}`)
}

export interface InvoiceHealthResponse {
  status: string
  orderCount: number
  latestInvoice: string | null
  pdfRoute: string
}

export interface InvoiceStatsResponse {
  totalInvoices: number
  totalRevenue: number
  byPaymentMethod: Array<{
    paymentMethod: string
    _count: number
    _sum: { total: number | null }
  }>
  period: string
}

export function fetchInvoiceHealth() {
  return apiFetch<InvoiceHealthResponse>('/admin/invoices/health')
}

export function fetchInvoiceStats(days = 30) {
  return apiFetch<InvoiceStatsResponse>(`/admin/invoices/stats/overview?days=${days}`)
}

export function fetchTransactions(search?: string) {
  const qs = search ? `?search=${encodeURIComponent(search)}` : ''
  return apiFetch<{
    transactions: ApiTransactionRow[]
    stats: { volume: number; successRate: number; pending: number; failed: number }
  }>(`/admin/commerce-finance/transactions${qs}`)
}

export interface TransactionHealthResponse {
  status: string
  paymentCount: number
  latestTxnId: string | null
  gateways: string[]
}

export interface ApiTransactionDetail extends ApiTransactionRow {
  method: string
  currency: string
  failureReason: string | null
  paidAt: string | null
  gatewayResponse: unknown
}

export function fetchTransactionHealth() {
  return apiFetch<TransactionHealthResponse>('/admin/commerce-finance/transactions/health')
}

export function fetchTransaction(id: string) {
  return apiFetch<ApiTransactionDetail>(`/admin/commerce-finance/transactions/${encodeURIComponent(id)}`)
}

export function fetchReturns(search?: string) {
  const qs = search ? `?search=${encodeURIComponent(search)}` : ''
  return apiFetch<ApiRmaRow[]>(`/admin/commerce-finance/returns${qs}`)
}

export type RmaApiStatus =
  | 'REQUESTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'ITEM_RECEIVED'
  | 'PROCESSED'
  | 'REFUNDED'
  | 'EXCHANGED'
  | 'CLOSED'

export function updateReturnStatus(
  id: string,
  data: { status: RmaApiStatus; note?: string; refundAmount?: number },
) {
  return apiFetch<{ id: string; rmaNumber: string; status: string }>(
    `/admin/commerce-finance/returns/${id}/status`,
    { method: 'PATCH', body: JSON.stringify(data) },
  )
}

export function createReturn(data: {
  orderId: string
  reason: string
  description?: string
  type?: 'RETURN' | 'EXCHANGE' | 'REPAIR'
}) {
  return apiFetch<{ id: string; rmaNumber: string; orderNumber: string; status: string }>(
    '/admin/commerce-finance/returns',
    { method: 'POST', body: JSON.stringify(data) },
  )
}
