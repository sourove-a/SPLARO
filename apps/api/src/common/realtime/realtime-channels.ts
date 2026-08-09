const ORDER_PREFIX = 'splaro:rt:order:'
const ADMIN_PREFIX = 'splaro:rt:admin:'
const SEQ_PREFIX = 'splaro:rt:seq:'

/** Order/store ids used in Redis channel names — reject injection / wildcards. */
export function isSafeRealtimeId(id: string): boolean {
  return /^[A-Za-z0-9._:-]{1,80}$/.test(id.trim())
}

export function orderRealtimeChannel(orderId: string): string {
  const id = orderId.trim()
  if (!isSafeRealtimeId(id)) {
    throw new Error('Invalid realtime order id')
  }
  return `${ORDER_PREFIX}${id}`
}

export function adminOrdersRealtimeChannel(storeId: string): string {
  const id = storeId.trim()
  if (!isSafeRealtimeId(id)) {
    throw new Error('Invalid realtime store id')
  }
  return `${ADMIN_PREFIX}${id}:orders`
}

export function orderRealtimeSeqKey(orderId: string): string {
  const id = orderId.trim()
  if (!isSafeRealtimeId(id)) {
    throw new Error('Invalid realtime order id')
  }
  return `${SEQ_PREFIX}${id}`
}

export function parseOrderIdFromChannel(channel: string): string | null {
  if (!channel.startsWith(ORDER_PREFIX)) return null
  const id = channel.slice(ORDER_PREFIX.length)
  return isSafeRealtimeId(id) ? id : null
}
