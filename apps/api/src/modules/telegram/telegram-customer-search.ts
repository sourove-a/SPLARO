/**
 * What an operator meant by what they typed into the bot.
 *
 * The lookup used to accept exactly one shape — a complete Bangladeshi mobile
 * number — and only ever searched `Order.shippingPhone`. Anything else fell
 * through to the AI chat or a hint: the last four digits someone remembered, a
 * name, an email, a customer code, and every customer who had registered but
 * not yet ordered, since they have no order row to be found in.
 *
 * Classifying the query first is what lets one input serve all of those without
 * guessing, and keeps the decision testable away from Prisma and the bot.
 */

export type CustomerQueryKind = 'phone' | 'code' | 'email' | 'name' | 'tooShort'

export type CustomerQuery = {
  kind: CustomerQueryKind
  /** Cleaned form to search with — digits for a phone, trimmed text otherwise. */
  term: string
  /** The last 10 digits of a phone, which is what matches across 88/+88/0 prefixes. */
  digits10?: string
}

/** Below this a search returns most of the shop, which is not a lookup. */
export const MIN_DIGITS = 4
export const MIN_NAME = 2

/** `01712345678`, `+8801712345678`, `8801712345678`, or a remembered fragment. */
function digitsOf(value: string): string {
  return value.replace(/\D/g, '')
}

/**
 * Customer codes are the store's own short identifiers. They are matched before
 * names so a code made of letters and digits is not searched as somebody's name.
 */
const CODE_PATTERN = /^[A-Z]{2,5}-?\d{3,8}$/i

export function classifyCustomerQuery(raw: string): CustomerQuery {
  const text = raw.trim()
  if (!text) return { kind: 'tooShort', term: '' }

  if (text.includes('@') && /^[^\s@]+@[^\s@]+$/.test(text)) {
    return { kind: 'email', term: text.toLowerCase() }
  }

  if (CODE_PATTERN.test(text) && /\d/.test(text)) {
    return { kind: 'code', term: text.toUpperCase() }
  }

  const digits = digitsOf(text)
  // Mostly digits means they typed a number, whole or remembered in part.
  const mostlyDigits = digits.length > 0 && digits.length >= text.replace(/\s/g, '').length - 1
  if (mostlyDigits) {
    if (digits.length < MIN_DIGITS) return { kind: 'tooShort', term: digits }
    return { kind: 'phone', term: digits, digits10: digits.slice(-10) }
  }

  if (text.length < MIN_NAME) return { kind: 'tooShort', term: text }
  return { kind: 'name', term: text }
}

/** A complete BD mobile, which is worth treating as an exact hit rather than a search. */
export function isCompleteBdMobile(raw: string): boolean {
  const digits = digitsOf(raw)
  return /^(?:88)?01\d{9}$/.test(digits)
}

/**
 * Whether a bare message should be taken as a customer lookup.
 *
 * Deliberately narrow: free text in a chat is the AI assistant's, and stealing
 * every sentence for a name search would break it. A run of digits is not
 * something anyone types at an assistant by accident, so that is the only shape
 * claimed without an explicit command.
 */
export function looksLikeCustomerLookup(raw: string): boolean {
  const text = raw.trim()
  if (!text) return false
  if (!/^[\d\s+()-]+$/.test(text)) return false
  return digitsOf(text).length >= MIN_DIGITS
}
