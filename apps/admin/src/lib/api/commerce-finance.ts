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

export function fetchTransactions(search?: string) {
  const qs = search ? `?search=${encodeURIComponent(search)}` : ''
  return apiFetch<{
    transactions: ApiTransactionRow[]
    stats: { volume: number; successRate: number; pending: number; failed: number }
  }>(`/admin/commerce-finance/transactions${qs}`)
}

export function fetchReturns(search?: string) {
  const qs = search ? `?search=${encodeURIComponent(search)}` : ''
  return apiFetch<ApiRmaRow[]>(`/admin/commerce-finance/returns${qs}`)
}
