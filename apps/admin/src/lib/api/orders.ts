import { apiFetch } from './client'

export interface ApiOrderItem {
  id: string
  quantity: number
  price?: number | string
  subtotal?: number | string
  productName?: string
  image?: string | null
  product?: { name: string; images?: { url: string }[] }
  variant?: { size?: string; color?: string; image?: string | null }
}

export interface ApiOrder {
  id: string
  invoiceNumber: string
  shippingName: string
  shippingPhone: string
  shippingCity: string
  shippingAddress?: string
  shippingDistrict?: string
  subtotal?: number | string
  deliveryCharge?: number | string
  total: number | string
  status: string
  paymentMethod: string
  paymentStatus: string
  isCodRisk: boolean
  requireAdvancePayment?: boolean
  createdAt: string
  updatedAt: string
  items: ApiOrderItem[]
  courier?: { provider?: string; status?: string; consignmentId?: string | null; trackingCode?: string | null } | null
  internalNotes?: { id: string; body: string; createdAt: string }[]
  customer?: { firstName?: string; lastName?: string; phone?: string; loyaltyTier?: string; codRiskScore?: number }
}

export interface OrdersListResponse {
  orders: ApiOrder[]
  total: number
  page: number
  totalPages: number
}

export function fetchOrders(params?: {
  status?: string
  page?: number
  limit?: number
  search?: string
}) {
  const qs = new URLSearchParams()
  if (params?.status) qs.set('status', params.status)
  if (params?.page) qs.set('page', String(params.page))
  if (params?.limit) qs.set('limit', String(params.limit))
  if (params?.search) qs.set('search', params.search)
  const query = qs.toString()
  return apiFetch<OrdersListResponse>(`/admin/orders${query ? `?${query}` : ''}`)
}

export function fetchOrder(id: string) {
  return apiFetch<ApiOrder & { notes?: { body: string }[]; customer?: unknown }>(`/admin/orders/${id}`)
}

export function updateOrderStatus(id: string, status: string, note?: string) {
  return apiFetch<ApiOrder>(`/admin/orders/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, note }),
  })
}

export type OrderPaymentStatus =
  | 'UNPAID'
  | 'PENDING'
  | 'PAID'
  | 'FAILED'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED'

export function setOrderCodRisk(
  id: string,
  data: { isCodRisk: boolean; requireAdvancePayment?: boolean },
) {
  return apiFetch<{
    id: string
    invoiceNumber: string
    isCodRisk: boolean
    requireAdvancePayment: boolean
  }>(`/admin/orders/${id}/cod-risk`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export function addOrderNote(id: string, body: string) {
  return apiFetch<{ id: string; body: string; createdAt: string }>(`/admin/orders/${id}/notes`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  })
}

export function updateOrderPaymentStatus(id: string, paymentStatus: OrderPaymentStatus) {
  return apiFetch<{
    id: string
    invoiceNumber: string
    paymentStatus: OrderPaymentStatus
    total: number | string
  }>(`/admin/orders/${id}/payment`, {
    method: 'PATCH',
    body: JSON.stringify({ paymentStatus }),
  })
}

export function deleteOrder(id: string) {
  return apiFetch<{ success: boolean }>(`/admin/orders/${id}`, { method: 'DELETE' })
}

export interface CreateOrderInput {
  customer: {
    name: string
    phone: string
    email?: string
    address: string
    city: string
    district?: string
    division?: string
  }
  items: Array<{
    productId: string
    variantId?: string
    quantity: number
    name: string
    price: number
    size?: string
    color?: string
  }>
  subtotal: number
  delivery: number
  discount?: number
  total: number
  paymentMethod: string
}

export function createOrder(input: CreateOrderInput) {
  return apiFetch<ApiOrder>('/admin/orders', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function bulkUpdateOrderStatus(orderIds: string[], status: string, note?: string) {
  return apiFetch<{ updated: number; failed: number; results?: Array<{ orderId: string; success: boolean }> }>(
    '/admin/orders/bulk/status',
    {
      method: 'POST',
      body: JSON.stringify({ orderIds, status, note }),
    },
  )
}

export type CourierProvider = 'STEADFAST' | 'PATHAO' | 'REDX' | 'PAPERFLY'

export function bookOrderCourier(id: string, provider?: CourierProvider) {
  return apiFetch<{
    success: boolean
    consignmentId?: string
    trackingCode?: string
    trackingUrl?: string
    error?: string
    simulated?: boolean
    alreadyBooked?: boolean
  }>(`/admin/orders/${id}/courier`, {
    method: 'POST',
    body: JSON.stringify(provider ? { provider } : {}),
  })
}

export function bookOrdersCourierBulk(orderIds: string[], provider?: CourierProvider) {
  return apiFetch<{
    booked: number
    failed: number
    results: Array<{
      orderId: string
      success: boolean
      error?: string
      consignmentId?: string
      simulated?: boolean
      alreadyBooked?: boolean
    }>
  }>('/admin/orders/bulk/courier', {
    method: 'POST',
    body: JSON.stringify({ orderIds, ...(provider ? { provider } : {}) }),
  })
}

export function sendOrderInvoiceEmail(id: string, email?: string) {
  return apiFetch<{ sent: boolean; to?: string }>(`/admin/orders/${id}/invoice/email`, {
    method: 'POST',
    body: JSON.stringify(email ? { email } : {}),
  })
}

export function fetchOrderInvoiceWhatsApp(id: string) {
  return apiFetch<{ supportUrl: string; customerUrl: string | null }>(
    `/admin/orders/${id}/invoice/whatsapp`,
  )
}

export function formatRelativeTime(iso: string) {
  if (!iso?.trim()) return '—'
  const trimmed = iso.trim()
  if (/^(just now|yesterday|\d+[mhd]\s+ago)$/i.test(trimmed)) return trimmed

  const ms = new Date(trimmed).getTime()
  if (Number.isNaN(ms)) return trimmed

  const diff = Date.now() - ms
  if (Number.isNaN(diff)) return '—'
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return days === 1 ? 'Yesterday' : `${days}d ago`
}

export function mapPaymentMethod(method: string): string {
  const map: Record<string, string> = {
    CASH_ON_DELIVERY: 'COD',
    BKASH: 'bKash',
    NAGAD: 'Nagad',
    SSLCOMMERZ: 'SSLCommerz',
    CARD: 'Paid',
    PAID: 'Paid',
  }
  return map[method] ?? method.replace(/_/g, ' ')
}

export function mapOrderStatus(status: string): string {
  return status.toLowerCase().replace(/_/g, ' ')
}
