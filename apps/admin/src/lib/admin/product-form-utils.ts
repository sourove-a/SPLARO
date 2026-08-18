/** Shared product form helpers — create + edit panels. */

/**
 * Fields the API keeps inside `schemaMarkup` instead of their own columns —
 * Bangla copy and the weaving label. Keep in sync with SCHEMA_EXTRA_KEYS in
 * the API's products controller.
 */
export const PRODUCT_SCHEMA_EXTRA_KEYS = ['nameBn', 'descriptionBn', 'weavingType'] as const

export type ProductSchemaExtras = Record<(typeof PRODUCT_SCHEMA_EXTRA_KEYS)[number], string>

export function parseProductSchemaMarkup(raw: unknown): ProductSchemaExtras {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return PRODUCT_SCHEMA_EXTRA_KEYS.reduce((acc, key) => {
    acc[key] = typeof o[key] === 'string' ? (o[key] as string) : ''
    return acc
  }, {} as ProductSchemaExtras)
}

export function parseTagsInput(raw: string): string[] {
  return raw.split(',').map((t) => t.trim()).filter(Boolean)
}

export function formatTagsInput(tags?: string[] | null): string {
  return tags?.join(', ') ?? ''
}

function parsePositiveMoney(raw: string): number {
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : 0
}

/** UI: regular + optional sale → API basePrice + compareAtPrice */
export function resolveSellingPrices(regularRaw: string, saleRaw: string): {
  sellingPrice: number
  compareAt?: number
} {
  const regular = parsePositiveMoney(regularRaw)
  const sale = parsePositiveMoney(saleRaw)
  const sellingPrice = sale || regular
  const compareAt = sale && regular > sale ? regular : undefined
  return { sellingPrice, ...(compareAt !== undefined ? { compareAt } : {}) }
}

/** Load edit form: API prices → regular + sale fields */
export function displayPriceFields(basePrice: number | string, compareAtPrice?: number | string | null): {
  regular: string
  sale: string
} {
  const base = Number(basePrice)
  const compare = compareAtPrice != null ? Number(compareAtPrice) : null
  if (compare && compare > base) {
    return { regular: String(compare), sale: String(base) }
  }
  return { regular: String(base), sale: '' }
}

/** Percent off main → sale. Null when there is no real markdown. */
export function discountPercentFromPrices(mainRaw: string, saleRaw: string): number | null {
  const main = parsePositiveMoney(mainRaw)
  const sale = parsePositiveMoney(saleRaw)
  if (!main || !sale || sale >= main) return null
  return Math.round(((main - sale) / main) * 100)
}

/** Sale price from main and a percent (1–99). Empty when the inputs cannot markdown. */
export function salePriceFromDiscountPercent(mainRaw: string, percentRaw: string): string {
  const main = parsePositiveMoney(mainRaw)
  const pct = Number(percentRaw)
  if (!main || !Number.isFinite(pct) || pct <= 0) return ''
  const clamped = Math.min(99, pct)
  const sale = Math.round(main * (1 - clamped / 100))
  return sale > 0 && sale < main ? String(sale) : ''
}

export function splitFitAndProductType(fitType?: string | null): { productType: string; fitType: string } {
  const raw = fitType?.trim() ?? ''
  if (!raw) return { productType: '', fitType: '' }
  const parts = raw.split(' · ')
  if (parts.length >= 2) {
    return { productType: parts[0] ?? '', fitType: parts.slice(1).join(' · ') }
  }
  return { productType: '', fitType: raw }
}

export function mergeFitAndProductType(productType: string, fitType: string): string {
  return [productType, fitType].filter(Boolean).join(' · ') || fitType
}
