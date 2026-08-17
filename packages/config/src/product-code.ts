/**
 * SPLARO Product Code — the permanent, customer-facing reference for a product.
 *
 *   Product Code: 284731
 *
 * Six digits, one per product (never per variant), assigned once and never
 * changed by a rename, a category move, a price edit or anything else. It is a
 * retail reference, not a secret and not a database key: `id` stays the
 * internal identity, the Product Code is what a shopper reads out on the phone
 * and what support types into admin search.
 *
 * Codes are drawn at random from the full six-digit range rather than counted
 * up, so the number does not leak how many products the store has or the order
 * in which they were added. Uniqueness is settled by the database, not here.
 *
 * Variant identity is a separate layer (see ./variant-identity):
 *
 *   Product Code  284731          shown to the customer
 *   Variant SKU   410-0123-01-42  warehouse, packing, returns
 *   Barcode       4100123010184   the same variant, in digits
 */

export const PRODUCT_CODE_LENGTH = 6
export const PRODUCT_CODE_MIN = 100_000
export const PRODUCT_CODE_MAX = 999_999

const PRODUCT_CODE_RE = /^[0-9]{6}$/

/** True for a well-formed six-digit Product Code. */
export function isValidProductCode(value: string | null | undefined): boolean {
  const raw = value?.trim()
  return Boolean(raw && PRODUCT_CODE_RE.test(raw))
}

/** Normalize operator input ("  284 731 " -> "284731"); null when unusable. */
export function normalizeProductCode(value: string | null | undefined): string | null {
  const digits = (value ?? '').replace(/\D/g, '')
  return digits.length === PRODUCT_CODE_LENGTH ? digits : null
}

/**
 * Random candidate. Callers insert it under a unique constraint and retry on
 * conflict — that is what makes concurrent creates safe, not this function.
 *
 * `random` is injectable so tests can force a collision.
 */
export function randomProductCode(random: () => number = Math.random): string {
  const span = PRODUCT_CODE_MAX - PRODUCT_CODE_MIN + 1
  const value = PRODUCT_CODE_MIN + Math.floor(random() * span)
  return String(Math.min(value, PRODUCT_CODE_MAX))
}

/*
 * Variant codes live in ./variant-identity — they hang off the Category Code
 * and style serial, not off this number. The Product Code names the product a
 * shopper sees; the variant SKU names the physical thing in a warehouse bin,
 * and keeping the two apart is what stops a packing slip or a return from
 * having to guess which one it is holding.
 */
