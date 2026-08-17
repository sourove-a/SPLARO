/**
 * SPLARO variant identity — the operational code for one sellable variant.
 *
 *   410-0123-01-42
 *   │   │    │  └── canonical size token
 *   │   │    └───── colour serial within the style
 *   │   └────────── style serial within the category
 *   └────────────── Category Code, frozen at issue
 *
 * This is deliberately not the customer-facing Product Code. The Product Code
 * (284731) names the product a shopper is looking at; this names the physical
 * thing in a warehouse bin, on a packing slip and in a return. Keeping them
 * apart means a label reprint, a return or a stock count never has to reason
 * about which of the two it is holding.
 *
 * Every segment is frozen at issue. The Category Code stays even if the product
 * is later moved to another storefront category — the SKU is a historical
 * identifier, not a live classification, and the labels are already printed.
 *
 * ─────────────────────────────────────────────────────────────
 * Barcode: INTERNAL USE ONLY — this is not a GS1 GTIN.
 *
 * The 13-digit payload is EAN-13 *shaped* (correct check digit, so any scanner
 * and label printer reads it) but the number space is SPLARO's own. It is valid
 * for SPLARO's warehouse, packing station and stock labels. It is NOT a
 * globally registered trade item number: selling through a channel that
 * requires a real GTIN means buying a GS1 prefix and storing those codes
 * separately. Do not present these as retail EANs.
 * ─────────────────────────────────────────────────────────────
 */

export const STYLE_SERIAL_DIGITS = 4
export const COLOUR_SERIAL_DIGITS = 2

/** Style serial within a category: 123 -> "0123". */
export function styleSerialCode(serial: number | string | null | undefined): string {
  const n = typeof serial === 'string' ? Number.parseInt(serial, 10) : serial
  const value = typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.floor(n) : 1
  return String(Math.min(value, 9999)).padStart(STYLE_SERIAL_DIGITS, '0')
}

/** Colour serial within a style: 1 -> "01". */
export function colourSerialCode(serial: number | null | undefined): string {
  const value = typeof serial === 'number' && Number.isFinite(serial) && serial > 0
    ? Math.floor(serial)
    : 1
  return String(Math.min(value, 99)).padStart(COLOUR_SERIAL_DIGITS, '0')
}

/**
 * Canonical size token.
 *
 * The customer-facing label can stay friendly ("One Size", "2 X Large"); the
 * SKU carries the normalized form, so "ONE SIZE", "OneSize" and "One-Size" can
 * never become three different SKUs for one physical shelf.
 */
export function canonicalSizeToken(size: string | null | undefined): string {
  const raw = (size ?? '').trim().toUpperCase()
  if (!raw) return 'OS'

  const compact = raw.replace(/[^A-Z0-9.]/g, '')
  if (!compact) return 'OS'

  if (/^(ONESIZE|ONE|FREESIZE|FREE|STD|STANDARD|OS)$/.test(compact)) return 'OS'
  if (/^(2XL|XXL)$/.test(compact)) return 'XXL'
  if (/^(3XL|XXXL)$/.test(compact)) return 'XXXL'
  if (/^(4XL|XXXXL)$/.test(compact)) return '4XL'
  if (/^(5XL|XXXXXL)$/.test(compact)) return '5XL'
  return compact
}

/** Readable variant SKU: 410-0123-01-42. */
export function buildVariantIdentitySku(input: {
  categoryCode: string
  styleSerial: number | string
  colourSerial: number
  size: string | null | undefined
}): string {
  return [
    input.categoryCode,
    styleSerialCode(input.styleSerial),
    colourSerialCode(input.colourSerial),
    canonicalSizeToken(input.size),
  ].join('-')
}

/**
 * Numeric ordinal for the barcode's size segment.
 *
 * Sizes are not numbers in general (XL, OS, 100ML), so the barcode carries an
 * ordinal while the SKU carries the label. These values are frozen: changing
 * one changes the barcode of every label already printed for that size.
 */
export const SIZE_ORDINALS: Record<string, number> = {
  OS: 0,
  XXS: 1,
  XS: 2,
  S: 3,
  M: 4,
  L: 5,
  XL: 6,
  XXL: 7,
  XXXL: 8,
  '4XL': 9,
  '5XL': 10,
}

export function sizeOrdinal(size: string | null | undefined): number {
  const token = canonicalSizeToken(size)
  const known = SIZE_ORDINALS[token]
  if (known !== undefined) return known

  // Numeric runs — shoe 36–46, waist 28–44, kids 2–16, and half sizes.
  const numeric = token.match(/^([0-9]+(?:\.[05])?)$/)
  if (numeric) {
    const doubled = Math.round(Number.parseFloat(numeric[1] as string) * 2)
    if (doubled >= 0 && doubled <= 698) return 100 + doubled
  }

  // Volume/weight labels (100ML, 50G) and anything else: deterministic hash so
  // a size nobody planned for still produces a stable, unique-enough barcode.
  let hash = 0
  for (const char of token) hash = (hash * 31 + char.charCodeAt(0)) % 199
  return 800 + hash
}

/** Standard EAN-13 check digit over the first 12 digits. */
export function ean13CheckDigit(twelveDigits: string): number {
  let sum = 0
  for (let i = 0; i < 12; i++) {
    const digit = twelveDigits.charCodeAt(i) - 48
    sum += i % 2 === 0 ? digit : digit * 3
  }
  return (10 - (sum % 10)) % 10
}

/**
 * Internal barcode for one variant — the same identity as the SKU, in digits:
 * category(3) + style(4) + colour(2) + size ordinal(3) + check(1) = 13.
 *
 * See the file header: EAN-13 shaped, SPLARO's own number space, not a GTIN.
 */
export function buildVariantIdentityBarcode(input: {
  categoryCode: string
  styleSerial: number | string
  colourSerial: number
  size: string | null | undefined
}): string {
  const body = [
    input.categoryCode.padStart(3, '0').slice(0, 3),
    styleSerialCode(input.styleSerial),
    colourSerialCode(input.colourSerial),
    String(sizeOrdinal(input.size)).padStart(3, '0'),
  ].join('')
  return `${body}${ean13CheckDigit(body)}`
}

/** True for a SPLARO-shaped 13-digit internal barcode with a valid check digit. */
export function isValidVariantIdentityBarcode(value: string | null | undefined): boolean {
  const raw = (value ?? '').trim()
  if (!/^[0-9]{13}$/.test(raw)) return false
  return ean13CheckDigit(raw.slice(0, 12)) === raw.charCodeAt(12) - 48
}

/** Parse a SPLARO variant SKU back into its parts; null when it is not one. */
export function parseVariantIdentitySku(sku: string | null | undefined): {
  categoryCode: string
  styleSerial: number
  colourSerial: number
  size: string
} | null {
  const match = (sku ?? '').trim().match(/^([0-9]{3})-([0-9]{4})-([0-9]{2})-([A-Z0-9.]+)$/)
  if (!match) return null
  return {
    categoryCode: match[1] as string,
    styleSerial: Number.parseInt(match[2] as string, 10),
    colourSerial: Number.parseInt(match[3] as string, 10),
    size: match[4] as string,
  }
}
