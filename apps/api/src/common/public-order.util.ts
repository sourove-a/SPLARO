import { displayOrderCode, isSplOrderCode } from '@splaro/config'

/** Public SPL-#### (or safe legacy label) — never a raw CUID. */
export function publicOrderCode(invoiceNumber: string | null | undefined, id: string): string {
  return displayOrderCode(invoiceNumber, id)
}

type OrderLike = {
  id: string
  invoiceNumber?: string | null
}

/**
 * Strip internal order id from storefront-facing payloads.
 * Keeps money/items intact; normalizes invoiceNumber to the public code.
 * Never expose IP / device / UA (admin fraud signals only).
 */
export function serializePublicOrder<T extends OrderLike>(order: T) {
  const orderCode = publicOrderCode(order.invoiceNumber, order.id)
  const invoiceNumber = isSplOrderCode(order.invoiceNumber)
    ? order.invoiceNumber!.toUpperCase()
    : orderCode

  const {
    id: _internalId,
    clientIp: _clientIp,
    deviceId: _deviceId,
    userAgent: _userAgent,
    ...rest
  } = order as T & {
    clientIp?: unknown
    deviceId?: unknown
    userAgent?: unknown
  }
  return {
    ...rest,
    orderCode,
    invoiceNumber,
  }
}

export function serializePublicOrders<T extends OrderLike>(orders: T[]) {
  return orders.map(serializePublicOrder)
}
