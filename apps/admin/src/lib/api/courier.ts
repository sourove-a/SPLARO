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

export function bookCourierShipment(orderId: string, provider?: string) {
  return apiFetch<{
    id: string
    status: string
    consignmentId?: string | null
    trackingCode?: string | null
    simulated?: boolean
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
