/**
 * Bangladesh phone formatting.
 *
 * House format is `01711-204556` — 11 digits, hyphen after the operator prefix.
 * The public support number is the only one shown internationally.
 * Search must be digit-aware, so `digitsOf` is exported alongside.
 */

const BD_OPERATOR: Record<string, string> = {
  '013': 'Grameenphone',
  '017': 'Grameenphone',
  '014': 'Banglalink',
  '019': 'Banglalink',
  '015': 'Teletalk',
  '016': 'Airtel',
  '018': 'Robi',
}

/** Every digit, country code stripped — use this for search comparisons. */
export function digitsOf(value: string | null | undefined): string {
  return String(value ?? '').replace(/\D/g, '')
}

/** Local 11-digit form (`01711204556`), or the raw digits when it is not a BD mobile. */
export function localBdNumber(value: string | null | undefined): string {
  const d = digitsOf(value).replace(/^880/, '')
  return d.length === 10 ? `0${d}` : d
}

/** `01711-204556`. Returns the input untouched when it is not an 11-digit BD number. */
export function formatBdPhone(value: string | null | undefined): string {
  const local = localBdNumber(value)
  if (local.length !== 11) return String(value ?? '')
  return `${local.slice(0, 5)}-${local.slice(5)}`
}

/** `tel:` target, always international so it dials from any handset. */
export function telHref(value: string | null | undefined): string {
  const local = localBdNumber(value)
  return `tel:+880${local.replace(/^0/, '')}`
}

/** Carrier behind the prefix — useful when a delivery keeps failing. */
export function operatorOf(value: string | null | undefined): string {
  return BD_OPERATOR[localBdNumber(value).slice(0, 3)] ?? 'Unknown operator'
}

/** True when the query's digits appear in the number — digit-aware search. */
export function phoneMatches(value: string | null | undefined, query: string): boolean {
  const q = digitsOf(query)
  if (!q) return false
  return digitsOf(value).includes(q)
}
