import { createHmac, timingSafeEqual } from 'crypto'

function resolveInvoiceAccessSecret(): string {
  return (
    process.env.INVOICE_ACCESS_SECRET ??
    process.env.REVALIDATE_SECRET ??
    process.env.INTERNAL_HEALTH_SECRET ??
    'splaro-invoice-dev'
  )
}

/** Short signed token for invoice links — not the raw order CUID. */
export function buildInvoiceAccessToken(orderId: string, secret?: string): string {
  const key = secret ?? resolveInvoiceAccessSecret()
  return createHmac('sha256', key).update(orderId).digest('hex').slice(0, 12)
}

export function verifyInvoiceAccessToken(
  orderId: string,
  token: string | null | undefined,
  secret?: string,
): boolean {
  if (!token?.trim()) return false
  const trimmed = token.trim()
  const expected = buildInvoiceAccessToken(orderId, secret)
  if (trimmed.length !== expected.length) {
    // Backward compat: old links used order.id as key
    return trimmed === orderId
  }
  try {
    return timingSafeEqual(Buffer.from(trimmed), Buffer.from(expected))
  } catch {
    return trimmed === orderId
  }
}
