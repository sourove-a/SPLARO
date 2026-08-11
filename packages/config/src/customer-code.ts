/** Public customer code format: SPL-C-000001, SPL-C-000002, … */
export const CUSTOMER_CODE_PREFIX = 'SPL-C'
export const CUSTOMER_CODE_START = 1
export const CUSTOMER_CODE_PAD = 6

const SPL_CUSTOMER_CODE_RE = /^SPL-C-(\d+)$/i
const INTERNAL_ID_RE = /^c[a-z0-9]{20,}$/i

export function parseSplCustomerNumber(code: string): number | null {
  const match = code.trim().match(SPL_CUSTOMER_CODE_RE)
  if (!match?.[1]) return null
  const n = Number.parseInt(match[1], 10)
  return Number.isFinite(n) ? n : null
}

export function isSplCustomerCode(code: string | null | undefined): boolean {
  if (!code?.trim()) return false
  return parseSplCustomerNumber(code) !== null
}

export function looksLikeInternalCustomerId(value: string): boolean {
  const trimmed = value.trim()
  return INTERNAL_ID_RE.test(trimmed) || trimmed.length >= 24
}

export function needsCustomerCodeBackfill(customerCode: string | null | undefined): boolean {
  return !isSplCustomerCode(customerCode)
}

/** Safe public label — never returns a raw CUID/UUID. */
export function displayCustomerCode(
  customerCode: string | null | undefined,
  id: string,
): string {
  const code = customerCode?.trim()
  if (code && isSplCustomerCode(code)) return code.toUpperCase()
  if (code && !looksLikeInternalCustomerId(code)) return code
  if (id && isSplCustomerCode(id)) return id.trim().toUpperCase()
  return 'Customer'
}

export function formatSplCustomerCode(sequence: number): string {
  const n = Math.max(0, Math.floor(sequence))
  return `${CUSTOMER_CODE_PREFIX}-${String(n).padStart(CUSTOMER_CODE_PAD, '0')}`
}
