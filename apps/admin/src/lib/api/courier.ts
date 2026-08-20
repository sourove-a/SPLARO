import { apiFetch } from './client'

export interface CourierShipmentRow {
  id: string
  orderId: string
  provider: string
  status: string
  consignmentId: string | null
  trackingCode: string | null
  failureReason: string | null
  createdAt: string
  updatedAt: string
  order: {
    invoiceNumber: string
    shippingName: string
    shippingPhone: string
    shippingAddress?: string
    status: string
  }
}

export interface CourierShipmentsResponse {
  items: CourierShipmentRow[]
  total: number
  page: number
  limit: number
}

export interface CourierStatsResponse {
  byStatus: { status: string; _count: number }[]
  byProvider: { provider: string; _count: number }[]
  recentFailed: {
    id: string
    orderId: string
    provider: string
    failureReason: string | null
    order: { invoiceNumber: string; shippingName: string }
  }[]
}

export interface CourierWebhookEvent {
  id: string
  event: string
  payload: Record<string, unknown>
  createdAt: string
}

export interface CourierShipmentDetail extends CourierShipmentRow {
  trackingUrl?: string | null
  pickedUpAt?: string | null
  deliveredAt?: string | null
  returnedAt?: string | null
  order: {
    invoiceNumber: string
    shippingName: string
    shippingPhone: string
    shippingAddress?: string
    total?: number
    paymentMethod?: string
    status: string
  }
  webhookEvents?: CourierWebhookEvent[]
}

export interface CourierTrackingResult {
  status: string | null
  provider: string | null
  consignmentId: string | null
  trackingCode: string | null
  trackingUrl: string | null
}

export function fetchCourierShipments(params?: {
  status?: string
  provider?: string
  search?: string
  page?: number
  limit?: number
}) {
  const qs = new URLSearchParams()
  if (params?.status) qs.set('status', params.status)
  if (params?.provider) qs.set('provider', params.provider)
  if (params?.search) qs.set('search', params.search)
  if (params?.page) qs.set('page', String(params.page))
  if (params?.limit) qs.set('limit', String(params.limit))
  const q = qs.toString()
  return apiFetch<CourierShipmentsResponse>(`/admin/courier${q ? `?${q}` : ''}`)
}

export function fetchCourierStats(days = 30) {
  return apiFetch<CourierStatsResponse>(`/admin/courier/stats/overview?days=${days}`)
}

export interface CourierProviderOption {
  value: string
  label: string
  recommended: boolean
  configured: boolean
}

export function fetchCourierProviders() {
  return apiFetch<{ providers: CourierProviderOption[] }>('/admin/courier/providers')
}

export function pickBookableCourierProvider(
  preferred: string | undefined,
  providers: CourierProviderOption[],
): string {
  if (preferred && providers.some((p) => p.value === preferred && p.configured)) return preferred
  return providers.find((p) => p.configured)?.value ?? 'STEADFAST'
}

export function bookCourierShipment(orderId: string, provider?: string) {
  return apiFetch<{
    id: string
    status: string
    consignmentId?: string | null
    trackingCode?: string | null
    simulated?: boolean
    alreadyBooked?: boolean
  }>(`/admin/courier/${orderId}/book`, {
    method: 'POST',
    body: JSON.stringify(provider ? { provider } : {}),
  })
}

export function retryCourierShipment(orderId: string, provider?: string) {
  return apiFetch<{ id: string; status: string; consignmentId?: string | null }>(
    `/admin/courier/${orderId}/retry`,
    {
      method: 'POST',
      body: JSON.stringify(provider ? { provider } : {}),
    },
  )
}

export function fetchCourierTracking(orderId: string) {
  return apiFetch<CourierTrackingResult>(`/admin/courier/${orderId}/track`)
}

export function fetchCourierShipmentDetail(orderId: string) {
  return apiFetch<CourierShipmentDetail>(`/admin/courier/${orderId}`)
}

export function cancelCourierBookingLocal(orderId: string, note?: string) {
  return apiFetch<{ id: string; status: string; localOnly: boolean }>(
    `/admin/courier/${orderId}/cancel-booking`,
    {
      method: 'POST',
      body: JSON.stringify({ note }),
    },
  )
}

export function updateCourierStatus(orderId: string, status: string, note?: string) {
  return apiFetch<CourierShipmentRow>(`/admin/courier/${orderId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, note }),
  })
}

export function bulkUpdateCourierStatus(orderIds: string[], status: string, note?: string) {
  return apiFetch<{ updated: number }>('/admin/courier/bulk/status', {
    method: 'POST',
    body: JSON.stringify({ orderIds, status, note }),
  })
}
