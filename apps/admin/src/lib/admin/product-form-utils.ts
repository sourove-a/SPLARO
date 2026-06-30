/** Shared product form helpers — create + edit panels. */

export function parseProductSchemaMarkup(raw: unknown): { nameBn: string; weavingType: string } {
  if (!raw || typeof raw !== 'object') return { nameBn: '', weavingType: '' }
  const o = raw as Record<string, unknown>
  return {
    nameBn: typeof o.nameBn === 'string' ? o.nameBn : '',
    weavingType: typeof o.weavingType === 'string' ? o.weavingType : '',
  }
}

export function buildProductSchemaMarkup(nameBn?: string, weavingType?: string): Record<string, string> | undefined {
  const extras: Record<string, string> = {}
  if (nameBn?.trim()) extras.nameBn = nameBn.trim()
  if (weavingType?.trim()) extras.weavingType = weavingType.trim()
  return Object.keys(extras).length ? extras : undefined
}

export function mergeProductSchemaMarkup(
  existing: unknown,
  nameBn?: string,
  weavingType?: string,
): Record<string, string> | undefined {
  const base =
    existing && typeof existing === 'object' && !Array.isArray(existing)
      ? { ...(existing as Record<string, string>) }
      : {}
  if (nameBn !== undefined) {
    if (nameBn.trim()) base.nameBn = nameBn.trim()
    else delete base.nameBn
  }
  if (weavingType !== undefined) {
    if (weavingType.trim()) base.weavingType = weavingType.trim()
    else delete base.weavingType
  }
  return Object.keys(base).length ? base : undefined
}

export function parseTagsInput(raw: string): string[] {
  return raw.split(',').map((t) => t.trim()).filter(Boolean)
}

export function formatTagsInput(tags?: string[] | null): string {
  return tags?.join(', ') ?? ''
}

/** UI: regular + optional sale → API basePrice + compareAtPrice */
export function resolveSellingPrices(regularRaw: string, saleRaw: string): {
  sellingPrice: number
  compareAt?: number
} {
  const regular = Number(regularRaw)
  const sale = saleRaw.trim() ? Number(saleRaw) : null
  const sellingPrice = sale && sale > 0 ? sale : regular
  const compareAt =
    sale && sale > 0 && regular > sale ? regular : undefined
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
