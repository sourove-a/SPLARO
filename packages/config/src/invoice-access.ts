import { createHmac, timingSafeEqual } from 'crypto'

const LEGACY_HMAC_HEX_LEN = 12
const DEV_FALLBACK_SECRET = 'splaro-invoice-dev'

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production'
}

function timingSafeHexEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false
  try {
    return timingSafeEqual(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'))
  } catch {
    return false
  }
}

/**
 * Dedicated invoice-link secrets only.
 * Production must set INVOICE_ACCESS_SECRET — no REVALIDATE / INTERNAL_HEALTH / dev fallback.
 * Optional INVOICE_ACCESS_SECRET_PREVIOUS covers key rotation.
 */
export function resolveInvoiceAccessSecrets(): string[] {
  const primary = process.env.INVOICE_ACCESS_SECRET?.trim()
  const previous = process.env.INVOICE_ACCESS_SECRET_PREVIOUS?.trim()
  const secrets: string[] = []
  if (primary) secrets.push(primary)
  if (previous && previous !== primary) secrets.push(previous)
  if (!secrets.length && !isProduction()) secrets.push(DEV_FALLBACK_SECRET)
  return secrets
}

function hmacHex(orderId: string, secret: string): string {
  return createHmac('sha256', secret).update(orderId).digest('hex')
}

/** Full HMAC-SHA256 hex (64 chars). Legacy 12-char tokens still verify. */
export function buildInvoiceAccessToken(orderId: string, secret?: string): string {
  const key = secret ?? resolveInvoiceAccessSecrets()[0]
  if (!key) {
    throw new Error('INVOICE_ACCESS_SECRET must be set in production')
  }
  return hmacHex(orderId, key)
}

/**
 * Strict HMAC check only. Never accept raw order id / invoice number as `key`
 * (that was a public IDOR: `?key=SPL-1234`).
 *
 * Compatibility window: accepts both full hex and the previous 12-char prefix.
 */
export function verifyInvoiceAccessToken(
  orderId: string,
  token: string | null | undefined,
  secret?: string,
): boolean {
  if (!token?.trim()) return false
  const trimmed = token.trim()
  const secrets = secret ? [secret] : resolveInvoiceAccessSecrets()
  if (!secrets.length) return false

  for (const key of secrets) {
    const full = hmacHex(orderId, key)
    const legacy = full.slice(0, LEGACY_HMAC_HEX_LEN)
    if (timingSafeHexEqual(trimmed, full) || timingSafeHexEqual(trimmed, legacy)) return true
  }
  return false
}
