/**
 * Single source of truth for "does the paid amount match the order total".
 *
 * Was previously duplicated across payments.controller (order-payable check +
 * Nagad verify) and sslcommerz.service (underpayment guard) with a ±1 tolerance,
 * which let every order be short-paid by 1 BDT. SSLCommerz's own IPN validator
 * already used 0.01 — the outer guards were loosening what it had tightened.
 */
export const PAYMENT_AMOUNT_TOLERANCE = 0.01

/** True when `paid` is within tolerance of `expected`. Non-finite `paid` is never a match. */
export function paymentAmountMatches(paid: number, expected: number): boolean {
  if (!Number.isFinite(paid) || !Number.isFinite(expected)) return false
  return Math.abs(paid - expected) <= PAYMENT_AMOUNT_TOLERANCE
}

/** True when `paid` falls short of `expected` by more than tolerance. */
export function isUnderpayment(paid: number, expected: number): boolean {
  if (!Number.isFinite(paid)) return true
  if (!Number.isFinite(expected)) return false
  return expected - paid > PAYMENT_AMOUNT_TOLERANCE
}
