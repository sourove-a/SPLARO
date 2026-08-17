import type { Prisma } from '@prisma/client'

/**
 * One rule for "the operator typed an identifier" across every admin list.
 *
 * Product Code, SKU and barcode were each searchable in a different place and
 * by different rules: the catalogue matched Product Code, the POS matched only
 * SKU and barcode, and order search matched none of them. So the number a
 * customer reads out over the phone worked on one screen and silently returned
 * nothing on the others. Anything that searches products now shares this.
 */

/**
 * Digits from whatever was typed, or null when there are too few to be a code.
 *
 * People say a Product Code in pieces — "9 5 6 7 7 2" — and read barcodes off a
 * label with spaces or dashes, so the separators are stripped rather than
 * required. Below three digits a `contains` match is noise: "12" would match
 * most of the catalogue.
 */
export function searchDigits(term: string): string | null {
  const digits = term.replace(/\D/g, '')
  return digits.length >= 3 ? digits : null
}

/**
 * Product-level filters for a free-text admin search.
 *
 * Deliberately includes the variant relations: an operator holding one physical
 * item is reading the label on that item, which carries the variant SKU and
 * barcode, not the parent product's.
 */
export function productSearchFilters(term: string): Prisma.ProductWhereInput[] {
  const text = term.trim()
  if (!text) return []
  const digits = searchDigits(text)

  const filters: Prisma.ProductWhereInput[] = [
    { name: { contains: text, mode: 'insensitive' } },
    { sku: { contains: text, mode: 'insensitive' } },
    { variants: { some: { sku: { contains: text, mode: 'insensitive' } } } },
  ]

  if (digits) {
    filters.push(
      { productCode: { contains: digits } },
      { barcode: { contains: digits } },
      { variants: { some: { barcode: { contains: digits } } } },
    )
  }

  return filters
}

/**
 * The same identifiers, expressed against an Order.
 *
 * Lets "which order had 956772 in it?" be answered from the orders screen — the
 * question that actually gets asked when a customer calls about a product they
 * received, quoting the only number printed on it.
 */
/**
 * Everything an operator might type into the orders search box.
 *
 * The customer-side fields come first because they are still the common case —
 * someone calls and gives their name or number. The product identifiers are
 * additive: they widen what the box accepts, they do not replace it.
 */
export function orderSearchFilters(term: string): Prisma.OrderWhereInput[] {
  const text = term.trim()
  if (!text) return []
  const digits = text.replace(/\D/g, '')

  return [
    { invoiceNumber: { contains: text, mode: 'insensitive' } },
    // Phone is matched on digits so "+880 1712-345678" finds "01712345678".
    { shippingPhone: { contains: digits.length >= 3 ? digits : text } },
    { shippingName: { contains: text, mode: 'insensitive' } },
    ...orderProductSearchFilters(text),
  ]
}

export function orderProductSearchFilters(term: string): Prisma.OrderWhereInput[] {
  const text = term.trim()
  if (!text) return []
  const digits = searchDigits(text)

  const filters: Prisma.OrderWhereInput[] = [
    { items: { some: { product: { sku: { contains: text, mode: 'insensitive' } } } } },
    { items: { some: { variant: { sku: { contains: text, mode: 'insensitive' } } } } },
  ]

  if (digits) {
    filters.push(
      { items: { some: { product: { productCode: { contains: digits } } } } },
      { items: { some: { variant: { barcode: { contains: digits } } } } },
    )
  }

  return filters
}
