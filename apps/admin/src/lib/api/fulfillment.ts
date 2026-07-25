import { apiFetch } from './client'

export type FulfillmentScanAction = 'pack' | 'dispatch'

export interface FulfillmentScanResult {
  ok: boolean
  action: FulfillmentScanAction
  orderId: string
  invoiceNumber: string
  customerName: string
  previousStatus: string
  status: string
  itemCount: number
  message: string
}

export interface FulfillmentTodayStats {
  packed: number
  shipped: number
}

export function scanFulfillment(code: string, action: FulfillmentScanAction) {
  return apiFetch<FulfillmentScanResult>('/admin/fulfillment/scan', {
    method: 'POST',
    body: JSON.stringify({ code, action }),
  })
}

export function fetchFulfillmentTodayStats() {
  return apiFetch<FulfillmentTodayStats>('/admin/fulfillment/stats/today')
}

export function trackCourierParcel(orderId: string) {
  return apiFetch<{
    status: string | null
    provider: string | null
    consignmentId: string | null
    trackingCode: string | null
    trackingUrl: string | null
  }>(`/admin/courier/${encodeURIComponent(orderId)}/track`)
}

export function cancelCourierBookingLocal(orderId: string, note?: string) {
  return apiFetch<{
    ok: boolean
    localOnly: true
    consignmentId: string | null
    trackingCode: string | null
    provider: string
    message: string
  }>(`/admin/courier/${encodeURIComponent(orderId)}/cancel-booking`, {
    method: 'POST',
    body: JSON.stringify(note ? { note } : {}),
  })
}
