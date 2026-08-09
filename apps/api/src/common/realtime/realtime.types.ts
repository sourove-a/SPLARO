/** V1 order events + reserved names for later finance/inventory/courier. */
export const REALTIME_ORDER_EVENT_TYPES = [
  'order.created',
  'order.status_changed',
  'order.payment_updated',
] as const

export type RealtimeOrderEventType = (typeof REALTIME_ORDER_EVENT_TYPES)[number]

export const REALTIME_RESERVED_EVENT_TYPES = [
  'inventory.updated',
  'courier.updated',
  'fulfillment.updated',
  'finance.updated',
] as const

export interface RealtimeOrderEvent {
  type: RealtimeOrderEventType
  orderId: string
  invoiceNumber?: string
  status?: string
  paymentStatus?: string
  updatedAt: string
  seq: number
}

export interface PublishOrderRealtimeInput {
  type: RealtimeOrderEventType
  orderId: string
  storeId: string
  invoiceNumber?: string | null
  status?: string | null
  paymentStatus?: string | null
  updatedAt?: Date | string | null
}

export function isRealtimeOrderEventType(value: string): value is RealtimeOrderEventType {
  return (REALTIME_ORDER_EVENT_TYPES as readonly string[]).includes(value)
}
