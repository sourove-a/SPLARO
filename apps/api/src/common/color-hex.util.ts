/** Canonical product swatch hex — `#rrggbb` lowercase. Shared by admin create + API. */

const DEFAULT_PRODUCT_HEX = '#111111'

export function normalizeProductHex(input: string | null | undefined): string | null {
  if (!input) return null
  const raw = input.trim().replace(/\s+/g, '')
  if (!raw || raw.startsWith('var(')) return null
  const withHash = raw.startsWith('#') ? raw : `#${raw}`
  const eight = /^#([0-9a-f]{8})$/i.exec(withHash)
  if (eight?.[1]) return `#${eight[1].slice(0, 6).toLowerCase()}`
  const short = /^#([0-9a-f]{3})$/i.exec(withHash)
  if (short?.[1]) {
    const [r, g, b] = short[1].split('')
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase()
  }
  if (/^#[0-9a-f]{6}$/i.test(withHash)) return withHash.toLowerCase()
  return null
}

export function productHexOrDefault(input: string | null | undefined): string {
  return normalizeProductHex(input) ?? DEFAULT_PRODUCT_HEX
}

/** class-validator friendly: #rgb / #rrggbb / #rrggbbaa */
export const PRODUCT_HEX_PATTERN = /^#?(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/
