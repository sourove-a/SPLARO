export type StorefrontRealtimeOrderEvent = {
  type: 'order.created' | 'order.status_changed' | 'order.payment_updated'
  orderId: string
  invoiceNumber?: string
  status?: string
  paymentStatus?: string
  updatedAt: string
  seq: number
}

const TYPES = new Set([
  'order.created',
  'order.status_changed',
  'order.payment_updated',
])

export function parseRealtimeOrderEvent(raw: unknown): StorefrontRealtimeOrderEvent | null {
  if (!raw || typeof raw !== 'object') return null
  const rec = raw as Record<string, unknown>
  if (typeof rec.type !== 'string' || !TYPES.has(rec.type)) return null
  if (typeof rec.orderId !== 'string' || !rec.orderId.trim()) return null
  if (typeof rec.seq !== 'number' || !Number.isFinite(rec.seq) || rec.seq < 1) return null
  if (typeof rec.updatedAt !== 'string' || !Number.isFinite(Date.parse(rec.updatedAt))) return null
  const event: StorefrontRealtimeOrderEvent = {
    type: rec.type as StorefrontRealtimeOrderEvent['type'],
    orderId: rec.orderId.trim(),
    updatedAt: rec.updatedAt,
    seq: Math.floor(rec.seq),
  }
  if (typeof rec.status === 'string' && rec.status.trim()) event.status = rec.status.trim()
  if (typeof rec.paymentStatus === 'string' && rec.paymentStatus.trim()) {
    event.paymentStatus = rec.paymentStatus.trim()
  }
  if (typeof rec.invoiceNumber === 'string' && rec.invoiceNumber.trim()) {
    event.invoiceNumber = rec.invoiceNumber.trim()
  }
  return event
}

export function shouldApplyRealtimeEvent(
  incoming: { seq: number; updatedAt: string },
  current: { seq: number; updatedAt?: string | undefined },
): boolean {
  if (incoming.seq <= current.seq) return false
  if (!current.updatedAt) return true
  const inc = Date.parse(incoming.updatedAt)
  const cur = Date.parse(current.updatedAt)
  if (Number.isFinite(inc) && Number.isFinite(cur) && inc < cur) return false
  return true
}

export function consumeSseChunk(
  buffer: string,
  onEvent: (data: unknown) => void,
): string {
  const parts = buffer.split('\n\n')
  const rest = parts.pop() ?? ''
  for (const block of parts) {
    for (const line of block.split('\n')) {
      if (!line.startsWith('data:')) continue
      const json = line.slice(5).trim()
      if (!json) continue
      try {
        onEvent(JSON.parse(json) as unknown)
      } catch {
        /* ignore malformed event */
      }
    }
  }
  return rest
}
