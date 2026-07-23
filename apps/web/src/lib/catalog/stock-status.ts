export type StockStatusKind = 'in_stock' | 'low_stock' | 'only_left' | 'sold_out'

export interface StockStatus {
  kind: StockStatusKind
  /** Units remaining across active variants (0 when sold out). */
  units: number
  label: string
}

/** Aligns with admin default low-stock threshold (5). */
export const LOW_STOCK_THRESHOLD = 5
/** Show exact count when urgency is high. */
export const ONLY_LEFT_THRESHOLD = 3

export function resolveStockStatus(units: number | null | undefined): StockStatus {
  const safe = Math.max(0, Math.floor(Number(units) || 0))
  if (safe <= 0) {
    return { kind: 'sold_out', units: 0, label: 'Sold Out' }
  }
  if (safe <= ONLY_LEFT_THRESHOLD) {
    return {
      kind: 'only_left',
      units: safe,
      label: safe === 1 ? 'Only 1 Left' : `Only ${safe} Left`,
    }
  }
  if (safe <= LOW_STOCK_THRESHOLD) {
    return { kind: 'low_stock', units: safe, label: 'Low Stock' }
  }
  return { kind: 'in_stock', units: safe, label: 'In Stock' }
}

export function stockUnitsFromVariantRefs(
  refs?: Array<{ stock?: number; isActive?: boolean }> | null,
): number {
  if (!refs?.length) return 0
  return refs
    .filter((ref) => ref.isActive !== false)
    .reduce((sum, ref) => sum + Math.max(0, Number(ref.stock) || 0), 0)
}
