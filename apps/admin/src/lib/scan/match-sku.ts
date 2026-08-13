/** Normalize scanner / typed SKU / barcode for equality checks. */
export function normalizeScanCode(raw: string | null | undefined): string {
  return (raw ?? '').trim().replace(/\s+/g, '').toUpperCase()
}

export function scanCodeMatches(
  scanned: string,
  ...candidates: Array<string | null | undefined>
): boolean {
  const needle = normalizeScanCode(scanned)
  if (!needle) return false
  return candidates.some((c) => Boolean(c) && normalizeScanCode(c) === needle)
}

export function matchStationItem<T extends { id: string; sku?: string | null; barcode?: string | null }>(
  items: T[],
  scanned: string,
): T | null {
  const needle = normalizeScanCode(scanned)
  if (!needle) return null
  return items.find((item) => scanCodeMatches(needle, item.sku, item.barcode)) ?? null
}
