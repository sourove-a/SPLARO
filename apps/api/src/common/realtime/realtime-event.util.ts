import {
  isRealtimeOrderEventType,
  type RealtimeOrderEvent,
} from './realtime.types'

const MAX_STATUS_LEN = 40
const MAX_INVOICE_LEN = 40

function asIso(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) return null
  return new Date(parsed).toISOString()
}

function asTrimmed(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined
  const next = value.trim()
  if (!next || next.length > max) return undefined
  return next
}

/** Strip anything that is not a minimal order realtime payload. */
export function sanitizeRealtimeOrderEvent(raw: unknown): RealtimeOrderEvent | null {
  if (!raw || typeof raw !== 'object') return null
  const rec = raw as Record<string, unknown>
  const type = typeof rec.type === 'string' ? rec.type : ''
  if (!isRealtimeOrderEventType(type)) return null

  const orderId = asTrimmed(rec.orderId, 80)
  if (!orderId) return null

  const seq = typeof rec.seq === 'number' && Number.isFinite(rec.seq) ? Math.floor(rec.seq) : NaN
  if (!Number.isFinite(seq) || seq < 1) return null

  const updatedAt = asIso(rec.updatedAt)
  if (!updatedAt) return null

  const event: RealtimeOrderEvent = {
    type,
    orderId,
    updatedAt,
    seq,
  }

  const invoiceNumber = asTrimmed(rec.invoiceNumber, MAX_INVOICE_LEN)
  if (invoiceNumber) event.invoiceNumber = invoiceNumber

  const status = asTrimmed(rec.status, MAX_STATUS_LEN)
  if (status) event.status = status

  const paymentStatus = asTrimmed(rec.paymentStatus, MAX_STATUS_LEN)
  if (paymentStatus) event.paymentStatus = paymentStatus

  return event
}

export function shouldApplyRealtimeEvent(
  incoming: { seq: number; updatedAt: string },
  current: { seq: number; updatedAt?: string },
): boolean {
  if (incoming.seq <= current.seq) return false
  if (!current.updatedAt) return true
  const inc = Date.parse(incoming.updatedAt)
  const cur = Date.parse(current.updatedAt)
  if (Number.isFinite(inc) && Number.isFinite(cur) && inc < cur) return false
  return true
}

export function formatSseData(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`
}

export function formatSseComment(text: string): string {
  return `: ${text}\n\n`
}

export function phonesMatchLast10(a: string, b: string): boolean {
  const na = a.replace(/\D/g, '')
  const nb = b.replace(/\D/g, '')
  if (na.length < 10 || nb.length < 10) return false
  return na.slice(-10) === nb.slice(-10)
}
