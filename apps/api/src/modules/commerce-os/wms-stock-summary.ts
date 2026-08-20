export type WmsStockSource = 'wms-bins' | 'product-inventory'

export const OPENING_STOCK_NOTE = 'Opening stock — recorded from product inventory'

export type WmsBinTotals = { available: number; reserved: number; damaged: number }

export type WmsVariantStock = {
  stock: number
  reservedStock: number
  isActive?: boolean
}

export function variantSellableQty(v: WmsVariantStock): number {
  if (v.isActive === false) return 0
  const onHand = Number(v.stock) || 0
  const reserved = Number(v.reservedStock) || 0
  return Math.max(0, onHand - (Number.isFinite(reserved) ? reserved : 0))
}

/**
 * Sellable KPI: product inventory when WMS bins have nothing on the shelf.
 * Checkout decrements ProductVariant.stock, not WarehouseBin.
 */
export function resolveWmsStockSummary(
  bins: WmsBinTotals,
  variants: WmsVariantStock[],
): WmsBinTotals & { source: WmsStockSource } {
  const active = variants.filter((v) => v.isActive !== false)
  const available = active.reduce((sum, v) => sum + variantSellableQty(v), 0)
  const reserved = active.reduce((sum, v) => {
    const n = Number(v.reservedStock) || 0
    return sum + (Number.isFinite(n) ? Math.max(0, n) : 0)
  }, 0)

  if (bins.available === 0 && bins.reserved === 0 && available > 0) {
    return {
      available,
      reserved,
      damaged: bins.damaged,
      source: 'product-inventory',
    }
  }

  return { ...bins, source: 'wms-bins' }
}

export function openingStockLedgerRows(
  storeId: string,
  variants: Array<{ id: string; sku: string | null; stock: number }>,
  alreadyLogged: ReadonlySet<string>,
) {
  return variants
    .filter((v) => v.stock > 0 && !alreadyLogged.has(v.id))
    .map((v) => ({
      storeId,
      variantId: v.id,
      sku: v.sku,
      reason: 'ADJUSTMENT' as const,
      quantityBefore: 0,
      quantityAfter: v.stock,
      delta: v.stock,
      note: OPENING_STOCK_NOTE,
    }))
}
