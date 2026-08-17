import { apiFetch } from './client'

export type FulfillmentScanAction = 'pack' | 'dispatch'

export interface FulfillmentStationItem {
  id: string
  name: string
  sku: string
  /** Parent Product Code — what the customer quotes on the phone. */
  productCode: string | null
  barcode: string | null
  size: string
  color: string
  quantity: number
  image: string | null
}

export interface FulfillmentStationOrder {
  orderId: string
  invoiceNumber: string
  status: string
  customerName: string
  customerPhone: string
  city: string
  district: string
  address: string
  paymentMethod: string
  paymentStatus: string
  total: number
  itemCount: number
  isCodRisk: boolean
  items: FulfillmentStationItem[]
  courier: {
    provider: string | null
    consignmentId: string | null
    trackingCode: string | null
    status: string | null
  } | null
}

export interface FulfillmentScanResult extends FulfillmentStationOrder {
  ok: boolean
  action: FulfillmentScanAction
  previousStatus: string
  message: string
}

export interface FulfillmentTodayStats {
  packed: number
  shipped: number
}

export function lookupFulfillment(code: string) {
  const qs = new URLSearchParams({ code: code.trim() })
  return apiFetch<FulfillmentStationOrder>(`/admin/fulfillment/lookup?${qs}`)
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
