import { BadRequestException } from '@nestjs/common'
import { OrderStatus } from '@prisma/client'

/**
 * Allowed forward transitions for each order status. CANCELLED and REFUNDED
 * are terminal (except CANCELLED → REFUNDED for refunding a cancelled prepaid
 * order). This stops nonsense like shipping a cancelled order or reverting a
 * delivered order to pending.
 */
const ORDER_STATUS_FLOW: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['CONFIRMED', 'PROCESSING', 'PACKED', 'COURIER_BOOKED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'PACKED', 'COURIER_BOOKED', 'SHIPPED', 'CANCELLED'],
  PROCESSING: ['PACKED', 'COURIER_BOOKED', 'SHIPPED', 'CANCELLED'],
  PACKED: ['COURIER_BOOKED', 'SHIPPED', 'CANCELLED'],
  COURIER_BOOKED: ['PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'SHIPPED', 'DELIVERED', 'RETURNED', 'CANCELLED'],
  SHIPPED: ['PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'RETURNED', 'CANCELLED'],
  PICKED_UP: ['IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'RETURNED', 'CANCELLED'],
  IN_TRANSIT: ['OUT_FOR_DELIVERY', 'DELIVERED', 'RETURNED', 'CANCELLED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'RETURNED', 'CANCELLED'],
  DELIVERED: ['RETURNED', 'REFUNDED'],
  RETURNED: ['REFUNDED'],
  CANCELLED: ['REFUNDED'],
  REFUNDED: [],
}

export function isOrderStatus(value: string): value is OrderStatus {
  return Object.prototype.hasOwnProperty.call(ORDER_STATUS_FLOW, value)
}

export function assertOrderStatusTransition(from: OrderStatus, to: string): OrderStatus {
  if (!isOrderStatus(to)) {
    throw new BadRequestException(`Unknown order status: ${to}`)
  }
  if (from === to) return to
  if (!ORDER_STATUS_FLOW[from].includes(to)) {
    throw new BadRequestException(`Cannot change order from ${from} to ${to}`)
  }
  return to
}

/** Statuses whose stock has been (or should be) returned to inventory. */
export const STOCK_RESTORING_STATUSES: readonly OrderStatus[] = ['CANCELLED', 'REFUNDED']
