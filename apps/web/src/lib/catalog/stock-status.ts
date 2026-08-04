export type StockStatusKind = 'in_stock' | 'only_left' | 'sold_out' | 'preorder'

export interface StockStatus {
  kind: StockStatusKind
  /** Units remaining across active variants (0 when sold out). Exact qty is for logic only. */
  units: number
  /** Customer-facing label — never exposes exact qty above LOW_STOCK_THRESHOLD. */
  label: string
}

/** Show exact count only in this urgency band (admin ops still see full qty). */
export const LOW_STOCK_THRESHOLD = 5

/**
 * Public stock labels for cards/PDP.
 * Exact quantities above 5 stay admin-only — never "In Stock · 126".
 */
export function resolveStockStatus(
  units: number | null | undefined,
  options?: { preorder?: boolean },
): StockStatus {
  if (options?.preorder) {
    return { kind: 'preorder', units: Math.max(0, Math.floor(Number(units) || 0)), label: 'Pre-order' }
  }
  const safe = Math.max(0, Math.floor(Number(units) || 0))
  if (safe <= 0) {
    return { kind: 'sold_out', units: 0, label: 'Out of stock' }
  }
  if (safe <= LOW_STOCK_THRESHOLD) {
    return {
      kind: 'only_left',
      units: safe,
      label: safe === 1 ? 'Only 1 left' : `Only ${safe} left`,
    }
  }
  return { kind: 'in_stock', units: safe, label: 'In stock' }
}

export function stockUnitsFromVariantRefs(
  refs?: Array<{ stock?: number; isActive?: boolean }> | null,
): number {
  if (!refs?.length) return 0
  return refs
    .filter((ref) => ref.isActive !== false)
    .reduce((sum, ref) => sum + Math.max(0, Number(ref.stock) || 0), 0)
}
