/** Canonical studio address — single source for footer, stores, contact, SEO. */
export const DEFAULT_STORE_ADDRESS =
  'House 84, Road 12, Sector 13, Uttara, Dhaka 1230, Bangladesh'

/** Line-broken display for cards / legal pages (same place, quieter wrap). */
export const DEFAULT_STORE_ADDRESS_LINES = [
  'House 84 · Road 12',
  'Sector 13, Uttara',
  'Dhaka 1230',
] as const

export const DEFAULT_STORE_LABEL = ''

/** Single public fallback identity when admin storefront settings are unavailable. */
export const DEFAULT_SUPPORT_EMAIL = 'info@splaro.co'

/** Public Bangladesh care line (local 01… form). Matches live store / invoice brand. */
export const DEFAULT_SUPPORT_PHONE = '01905010205'
export const DEFAULT_SUPPORT_PHONE_E164 = '+8801905010205'

const CANONICAL_STUDIO_RE = /^House\s*#?\s*84\b/i

/** True for the Uttara studio address (with or without legacy # marks). */
export function isCanonicalStudioAddress(address: string): boolean {
  return CANONICAL_STUDIO_RE.test(address.replace(/\s+/g, ' ').trim())
}

/** Strip noisy “#” marks from Bangladesh house/road labels for display. */
export function beautifyStoreAddress(address: string): string {
  return address
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\bHouse\s*#\s*/gi, 'House ')
    .replace(/\bRoad\s*#\s*/gi, 'Road ')
    .replace(/\bRd\s*#\s*/gi, 'Rd ')
    .replace(/\bDhaka-1230\b/gi, 'Dhaka 1230')
}

/** Pretty multiline for UI; falls back to comma-split when admin overrides the default. */
export function formatStoreAddressLines(address: string): string[] {
  const normalized = beautifyStoreAddress(address)
  if (!normalized) return [...DEFAULT_STORE_ADDRESS_LINES]
  if (normalized === DEFAULT_STORE_ADDRESS || isCanonicalStudioAddress(normalized)) {
    return [...DEFAULT_STORE_ADDRESS_LINES]
  }
  return normalized
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
}

/** Footer Visit-store split — primary street line + soft locality line. */
export function splitStoreAddressForDisplay(address: string): {
  place: string
  locality: string
  country: string
  full: string
} {
  const full = beautifyStoreAddress(address)
  if (isCanonicalStudioAddress(full)) {
    return {
      place: 'House 84 · Road 12',
      locality: 'Sector 13, Uttara',
      country: 'Dhaka 1230',
      full: DEFAULT_STORE_ADDRESS,
    }
  }
  const parts = full
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
  if (parts.length < 2) return { place: full, locality: '', country: '', full }
  if (parts.length === 2) {
    return { place: parts[0] ?? full, locality: '', country: parts[1] ?? '', full }
  }
  return {
    place: parts.slice(0, -2).join(', '),
    locality: parts[parts.length - 2] ?? '',
    country: parts[parts.length - 1] ?? '',
    full,
  }
}
