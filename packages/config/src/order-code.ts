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

/** Safe public label — never returns a full CUID/UUID. */
export function displayOrderCode(
  invoiceNumber: string | null | undefined,
  id: string,
): string {
  const code = invoiceNumber?.trim()
  if (code && isSplOrderCode(code)) return code.toUpperCase()
  if (code && !looksLikeInternalOrderId(code)) return code
  const tail = (id.replace(/\D/g, '').slice(-4) || id.slice(-4)).toUpperCase()
  return `${ORDER_CODE_PREFIX}-${tail}`
}

export function formatSplOrderCode(sequence: number): string {
  return `${ORDER_CODE_PREFIX}-${sequence}`
}
