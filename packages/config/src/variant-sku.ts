/**
 * Canonical variant SKU format: SPL-{CAT}-{MODEL}-{COLOR}-{SIZE}
 *
 *   SPL-ABY-001-BLK-M      Classic Abaya / Black / M
 *   SPL-SAR-001-BLK-OS     Saree / Black / one size
 *   SPL-SHO-021-BRN-42     Footwear / Brown / 42
 *
 * One module, two consumers: the admin panel renders a live preview from the
 * current form state, and the API rebuilds the same string as the authoritative
 * value on save. Never fork this logic — a second implementation is how the
 * preview and the stored SKU drift apart.
 */

export const SKU_PREFIX = 'SPL'
export const SKU_MODEL_PAD = 3
/** Size segment for products that genuinely have no size run (saree, wallet, watch). */
export const SKU_ONE_SIZE = 'OS'
/** Colour segment when a variant legitimately carries no colour. */
export const SKU_NO_COLOR = 'NA'

/** Merchant-facing category short codes. Matched on category name or slug. */
export const CATEGORY_CODES: Record<string, string> = {
  abaya: 'ABY',
  kaftan: 'KFT',
  saree: 'SAR',
  sarees: 'SAR',
  shirt: 'SHR',
  shirts: 'SHR',
  panjabi: 'PNJ',
  punjabi: 'PNJ',
  footwear: 'SHO',
  shoe: 'SHO',
  shoes: 'SHO',
  sandal: 'SHO',
  sandals: 'SHO',
  sneaker: 'SHO',
  sneakers: 'SHO',
  wallet: 'WAL',
  wallets: 'WAL',
  watch: 'WAT',
  watches: 'WAT',
  'prayer cap': 'CAP',
  'prayer caps': 'CAP',
  cap: 'CAP',
  caps: 'CAP',
  'prayer mat': 'MAT',
  'prayer mats': 'MAT',
  bag: 'BAG',
  bags: 'BAG',
  handbag: 'BAG',
  handbags: 'BAG',
  'school bag': 'BAG',
  'school bags': 'BAG',
  'school-bags': 'BAG',
  jewelry: 'JWL',
  jewellery: 'JWL',
  glasses: 'GLS',
  sunglasses: 'GLS',
  kurti: 'KUR',
  kurta: 'KUR',
  tshirt: 'TSH',
  't-shirt': 'TSH',
  trouser: 'TRS',
  trousers: 'TRS',
  pant: 'TRS',
  pants: 'TRS',
}

/** Normalized colour short codes. */
export const COLOR_CODES: Record<string, string> = {
  black: 'BLK',
  white: 'WHT',
  brown: 'BRN',
  beige: 'BGE',
  navy: 'NVY',
  'navy blue': 'NVY',
  grey: 'GRY',
  gray: 'GRY',
  green: 'GRN',
  red: 'RED',
  blue: 'BLU',
  pink: 'PNK',
  purple: 'PRP',
  yellow: 'YLW',
  orange: 'ORG',
  maroon: 'MRN',
  cream: 'CRM',
  gold: 'GLD',
  silver: 'SLV',
  olive: 'OLV',
  teal: 'TEL',
  ivory: 'IVR',
  charcoal: 'CHR',
  mustard: 'MST',
  rust: 'RST',
  multicolour: 'MLT',
  multicolor: 'MLT',
  multi: 'MLT',
}

/**
 * Category codes whose products have no size run at all. The admin panel hides
 * the size field for these and the SKU falls back to `OS`.
 */
export const SIZELESS_CATEGORY_CODES = new Set([
  'SAR',
  'WAL',
  'WAT',
  'CAP',
  'MAT',
  'BAG',
  'JWL',
  'GLS',
])

function normalizeKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Strip to A–Z0–9 and cut to `length`, uppercased. */
function alnum(value: string, length: number): string {
  return value.replace(/[^a-z0-9]/gi, '').slice(0, length).toUpperCase()
}

/**
 * Category name/slug -> 3-letter code. Falls back to the first letters of the
 * name so an unmapped category still produces a stable, readable code.
 */
export function categoryCode(nameOrSlug: string | null | undefined): string {
  const raw = (nameOrSlug ?? '').trim()
  if (!raw) return 'GEN'

  const key = normalizeKey(raw)
  const direct = CATEGORY_CODES[key]
  if (direct) return direct

  // "Women's Saree", "kids-footwear" — match any known word inside the label.
  for (const [word, code] of Object.entries(CATEGORY_CODES)) {
    if (word.includes(' ')) {
      if (key.includes(word)) return code
    } else if (key.split(' ').includes(word)) {
      return code
    }
  }

  return alnum(key.replace(/\s+/g, ''), 3).padEnd(3, 'X') || 'GEN'
}

/** Colour name -> 3-letter code, falling back to the first letters of the name. */
export function colorCode(name: string | null | undefined): string {
  const raw = (name ?? '').trim()
  if (!raw) return SKU_NO_COLOR

  const key = normalizeKey(raw)
  // "Default" is the placeholder a colourless product carries, not a colour —
  // SPL-WAT-001-NA-OS reads better than SPL-WAT-001-DEF-OS.
  if (key === 'default' || key === 'none' || key === 'na') return SKU_NO_COLOR
  const direct = COLOR_CODES[key]
  if (direct) return direct

  for (const [word, code] of Object.entries(COLOR_CODES)) {
    if (key.split(' ').includes(word)) return code
  }

  const fallback = alnum(key.replace(/\s+/g, ''), 3)
  return fallback ? fallback.padEnd(3, 'X') : SKU_NO_COLOR
}

/** Size label -> SKU segment. Empty/missing size means one-size (`OS`). */
export function sizeCode(size: string | null | undefined): string {
  const raw = (size ?? '').trim()
  if (!raw) return SKU_ONE_SIZE
  const compact = alnum(raw, 6)
  return compact || SKU_ONE_SIZE
}

/** Model sequence -> zero-padded segment (1 -> "001"). */
export function modelCode(model: number | string | null | undefined): string {
  const n = typeof model === 'string' ? Number.parseInt(model, 10) : model
  if (typeof n === 'number' && Number.isFinite(n) && n > 0) {
    return String(Math.floor(n)).padStart(SKU_MODEL_PAD, '0')
  }
  const raw = typeof model === 'string' ? alnum(model, 6) : ''
  return raw || '001'.padStart(SKU_MODEL_PAD, '0')
}

export interface VariantSkuParts {
  /** Category name, slug, or an already-resolved 3-letter code. */
  category: string | null | undefined
  /** Model sequence within the category (1, 2, 3…). */
  model: number | string | null | undefined
  color?: string | null
  size?: string | null
}

/** Build the canonical SKU. Deterministic — same parts always give the same string. */
export function buildVariantSku(parts: VariantSkuParts): string {
  const cat = categoryCode(parts.category)
  return [SKU_PREFIX, cat, modelCode(parts.model), colorCode(parts.color), sizeCode(parts.size)].join(
    '-',
  )
}

/** True when this category's products have no size run (saree, wallet, watch…). */
export function categoryIsSizeless(nameOrSlug: string | null | undefined): boolean {
  return SIZELESS_CATEGORY_CODES.has(categoryCode(nameOrSlug))
}

const SKU_SAFE_RE = /^[A-Z0-9][A-Z0-9-]*$/

/** Uppercase, collapse whitespace/underscores to hyphens, strip unsafe chars. */
export function normalizeSku(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^A-Z0-9-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
}

/** Format check for manually entered SKUs. Does not check uniqueness. */
export function isValidSku(value: string): boolean {
  const normalized = normalizeSku(value)
  return normalized.length >= 3 && normalized.length <= 80 && SKU_SAFE_RE.test(normalized)
}

/* ── Internal barcode (CODE128 payload) ─────────────────────── */

export const BARCODE_START = 1_000_000_001
export const BARCODE_DIGITS = 10
export const BARCODE_SYMBOLOGY = 'CODE128'

/** Sequence value -> stored barcode string. Kept as a string so leading digits are safe. */
export function formatBarcode(value: number | bigint): string {
  return String(value).padStart(BARCODE_DIGITS, '0')
}

export function isValidInternalBarcode(value: string | null | undefined): boolean {
  const raw = value?.trim() ?? ''
  if (!/^\d{10}$/.test(raw)) return false
  return Number.parseInt(raw, 10) >= BARCODE_START
}
