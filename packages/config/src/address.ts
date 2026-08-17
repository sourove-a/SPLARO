/**
 * Normalizes an address token for deduplication comparison (lowercase, trimmed, strip excess punctuation).
 */
export function normalizeAddressToken(token: string): string {
  return token
    .toLowerCase()
    .replace(/[.,|;/\\]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Splits a raw address or combination of address fields into clean, non-empty chunks.
 */
export function splitAddressTokens(...inputs: (string | null | undefined)[]): string[] {
  const result: string[] = []
  for (const input of inputs) {
    if (!input || typeof input !== 'string') continue
    const parts = input.split(/[,|\n\r;]+/)
    for (const part of parts) {
      const trimmed = part
        .trim()
        .replace(/^[.,|;:/\\]+|[.,|;:/\\]+$/g, '')
        .trim()
      if (trimmed) {
        result.push(trimmed)
      }
    }
  }
  return result
}

/**
 * Deduplicates and formats an address from any combination of address lines,
 * city, district, thana, division, or postal code.
 *
 * Example:
 * formatCleanAddress('Natornibash, Uttar RajaBari, Turag Uttara 1230, Uttara, Dhaka', 'Dhaka', 'Dhaka')
 * => 'Natornibash, Uttar RajaBari, Turag Uttara 1230, Uttara, Dhaka'
 */
export function formatCleanAddress(...inputs: (string | null | undefined)[]): string {
  const tokens = splitAddressTokens(...inputs)
  if (tokens.length === 0) return ''

  const seen = new Set<string>()
  const uniqueTokens: string[] = []

  for (const token of tokens) {
    const key = normalizeAddressToken(token)
    if (!key) continue
    if (seen.has(key)) continue
    seen.add(key)
    uniqueTokens.push(token)
  }

  return uniqueTokens.join(', ')
}
