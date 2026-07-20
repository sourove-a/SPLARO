/** Public order code format: SPL-1001, SPL-1002, … */
export const ORDER_CODE_PREFIX = 'SPL'
export const ORDER_CODE_START = 1001

const SPL_ORDER_CODE_RE = /^SPL-(\d+)$/i
const INTERNAL_ID_RE = /^c[a-z0-9]{20,}$/i

export function parseSplOrderNumber(code: string): number | null {
  const match = code.trim().match(SPL_ORDER_CODE_RE)
  if (!match?.[1]) return null
  const n = Number.parseInt(match[1], 10)
  return Number.isFinite(n) ? n : null
}

export function isSplOrderCode(code: string | null | undefined): boolean {
  if (!code?.trim()) return false
  return parseSplOrderNumber(code) !== null
}

export function looksLikeInternalOrderId(value: string): boolean {
  const trimmed = value.trim()
  return INTERNAL_ID_RE.test(trimmed) || trimmed.length >= 24
}

/** True when invoiceNumber should be replaced with a generated SPL-#### code. */
export function needsInvoiceCodeBackfill(invoiceNumber: string | null | undefined, id: string): boolean {
  const code = invoiceNumber?.trim()
  if (!code) return true
  if (isSplOrderCode(code)) return false
  if (code === id) return true
  if (looksLikeInternalOrderId(code)) return true
  return false
}

/** Safe public label — never returns a raw CUID/UUID or fake SPL-#### from id digits. */
export function displayOrderCode(
  invoiceNumber: string | null | undefined,
  id: string,
): string {
  const code = invoiceNumber?.trim()
  if (code && isSplOrderCode(code)) return code.toUpperCase()
  if (code && !looksLikeInternalOrderId(code)) return code
  // Internal id only — do not invent a random-looking SPL-#### from CUID chars
  if (id && !looksLikeInternalOrderId(id) && isSplOrderCode(id)) {
    return id.trim().toUpperCase()
  }
  return 'Order'
}

/** Tab / SEO title — never claim “confirmed” until the client verifies the order. */
export function orderDocumentTitle(idOrInvoice: string): string {
  const raw = idOrInvoice.trim()
  if (!raw) return 'Order status'
  if (isSplOrderCode(raw)) return `Order ${raw.toUpperCase()}`
  if (!looksLikeInternalOrderId(raw) && raw.length <= 24) {
    return `Order ${raw.toUpperCase()}`
  }
  return 'Order status'
}

/** Success tab title after the order payload is verified client-side. */
export function orderConfirmedDocumentTitle(idOrInvoice: string): string {
  const base = orderDocumentTitle(idOrInvoice)
  if (base === 'Order status') return 'Order confirmed'
  return `${base} confirmed`
}

export function formatSplOrderCode(sequence: number): string {
  return `${ORDER_CODE_PREFIX}-${sequence}`
}
