import {
  openingStockLedgerRows,
  resolveWmsStockSummary,
} from './wms-stock-summary'

describe('resolveWmsStockSummary', () => {
  it('uses product sellable qty when bins are empty', () => {
    const summary = resolveWmsStockSummary(
      { available: 0, reserved: 0, damaged: 0 },
      [{ stock: 100, reservedStock: 1, isActive: true }],
    )
    expect(summary).toEqual({
      available: 99,
      reserved: 1,
      damaged: 0,
      source: 'product-inventory',
    })
  })

  it('keeps bin totals when the warehouse has qty', () => {
    const summary = resolveWmsStockSummary(
      { available: 40, reserved: 2, damaged: 1 },
      [{ stock: 99, reservedStock: 0, isActive: true }],
    )
    expect(summary).toEqual({
      available: 40,
      reserved: 2,
      damaged: 1,
      source: 'wms-bins',
    })
  })

  it('ignores inactive variants and does not go negative', () => {
    const summary = resolveWmsStockSummary(
      { available: 0, reserved: 0, damaged: 0 },
      [
        { stock: 10, reservedStock: 0, isActive: false },
        { stock: 3, reservedStock: 8, isActive: true },
      ],
    )
    expect(summary.available).toBe(0)
    expect(summary.source).toBe('wms-bins')
  })
})

describe('openingStockLedgerRows', () => {
  it('writes ADJUSTMENT rows at current qty and does not include a stock mutation', () => {
    const rows = openingStockLedgerRows(
      'store-1',
      [
        { id: 'v1', sku: 'SPL-KFT-001', stock: 99 },
        { id: 'v2', sku: 'SPL-ABY-001', stock: 0 },
        { id: 'v3', sku: 'SPL-SHR-001', stock: 12 },
      ],
      new Set(['v3']),
    )
    expect(rows).toEqual([
      {
        storeId: 'store-1',
        variantId: 'v1',
        sku: 'SPL-KFT-001',
        reason: 'ADJUSTMENT',
        quantityBefore: 0,
        quantityAfter: 99,
        delta: 99,
        note: 'Opening stock — recorded from product inventory',
      },
    ])
    expect(rows[0]).not.toHaveProperty('stock')
    expect(rows[0]?.quantityAfter).toBe(99)
  })
})
