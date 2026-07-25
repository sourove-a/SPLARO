/** Public payment code format: PAY-1001, PAY-1002, … */
export const PAYMENT_CODE_PREFIX = 'PAY'
export const PAYMENT_CODE_START = 1001

const PAY_CODE_RE = /^PAY-(\d+)$/i

export function parsePayNumber(code: string): number | null {
  const match = code.trim().match(PAY_CODE_RE)
  if (!match?.[1]) return null
  const n = Number.parseInt(match[1], 10)
  return Number.isFinite(n) ? n : null
}

export function isPayCode(code: string | null | undefined): boolean {
  if (!code?.trim()) return false
  return parsePayNumber(code) !== null
}

export function formatPayCode(sequence: number): string {
  return `${PAYMENT_CODE_PREFIX}-${sequence}`
}

export function needsPaymentCodeBackfill(paymentNumber: string | null | undefined): boolean {
  return !isPayCode(paymentNumber)
}
