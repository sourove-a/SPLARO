import {
  applyPaymentToBalance,
  applyPurchaseToBalance,
  computePurchaseTotals,
  describeEta,
  nextSequenceCode,
  normalizePhone,
  normalizePurchaseItems,
  resolveExpectedAt,
  reversePurchaseFromBalance,
  reverseStockDelta,
  splitStockableItems,
} from './procurement.core'

describe('normalizePurchaseItems', () => {
  it('keeps a free-text line that names no catalog product', () => {
    const [item] = normalizePurchaseItems([
      { productName: '  Cotton panjabi  ', quantity: 5, unitCost: 480 },
    ])
    expect(item).toMatchObject({
      productId: null,
      variantId: null,
      productName: 'Cotton panjabi',
      quantity: 5,
      unitCostPaisa: 48000,
      lineTotalPaisa: 240000,
    })
  })

  it('keeps a catalog line that carries no typed name', () => {
    const items = normalizePurchaseItems([{ variantId: 'var_1', quantity: 2, unitCost: 100 }])
    expect(items).toHaveLength(1)
    expect(items[0]!.variantId).toBe('var_1')
  })

  it('drops a line with neither a name nor a catalog link', () => {
    expect(normalizePurchaseItems([{ productName: '   ', quantity: 3, unitCost: 10 }])).toEqual([])
  })

  it('floors quantity at 1 and cost at 0', () => {
    const [item] = normalizePurchaseItems([{ productName: 'X', quantity: 0, unitCost: -50 }])
    expect(item).toMatchObject({ quantity: 1, unitCostPaisa: 0, lineTotalPaisa: 0 })
  })
})

describe('computePurchaseTotals', () => {
  it('adds charges and splits paid from due', () => {
    const items = normalizePurchaseItems([
      { productName: 'A', quantity: 3, unitCost: 250 },
      { productName: 'B', quantity: 2, unitCost: 125.5 },
    ])
    expect(computePurchaseTotals(items, { transportCost: 120, paidAmount: 500 })).toEqual({
      subtotal: 1001,
      discount: 0,
      transportCost: 120,
      otherCost: 0,
      total: 1121,
      paidAmount: 500,
      dueAmount: 621,
    })
  })

  it('does not drift on repeated decimal costs', () => {
    // 0.1 + 0.2 arithmetic is exactly how a supplier balance ends up a paisa
    // out after a few hundred entries.
    const items = normalizePurchaseItems(
      Array.from({ length: 300 }, () => ({ productName: 'A', quantity: 1, unitCost: 0.1 })),
    )
    expect(computePurchaseTotals(items).total).toBe(30)
  })

  it('clamps a discount larger than the goods so the total never goes negative', () => {
    const items = normalizePurchaseItems([{ productName: 'A', quantity: 1, unitCost: 100 }])
    const totals = computePurchaseTotals(items, { discount: 500 })
    expect(totals.discount).toBe(100)
    expect(totals.total).toBe(0)
  })

  it('clamps overpayment instead of recording negative due', () => {
    const items = normalizePurchaseItems([{ productName: 'A', quantity: 1, unitCost: 100 }])
    const totals = computePurchaseTotals(items, { paidAmount: 5000 })
    expect(totals.paidAmount).toBe(100)
    expect(totals.dueAmount).toBe(0)
  })

  it('treats missing or junk charges as zero rather than NaN', () => {
    const items = normalizePurchaseItems([{ productName: 'A', quantity: 1, unitCost: 10 }])
    expect(computePurchaseTotals(items, { discount: undefined, paidAmount: 'x' })).toMatchObject({
      total: 10,
      paidAmount: 0,
      dueAmount: 10,
    })
  })
})

describe('nextSequenceCode', () => {
  it('continues from the highest existing number', () => {
    expect(nextSequenceCode('SUP', ['SUP-0001', 'SUP-0009', 'SUP-0003'])).toBe('SUP-0010')
  })

  it('does not reuse a number after a row is deleted', () => {
    // A count-based scheme would return SUP-0003 here and collide with the
    // surviving row on the unique index.
    expect(nextSequenceCode('SUP', ['SUP-0001', 'SUP-0003'])).toBe('SUP-0004')
  })

  it('ignores codes that do not match the prefix', () => {
    expect(nextSequenceCode('PO', ['SUP-0007', null, undefined, 'PO-0002'])).toBe('PO-0003')
  })

  it('starts at 0001 when nothing exists', () => {
    expect(nextSequenceCode('SUP', [])).toBe('SUP-0001')
  })
})

describe('normalizePhone', () => {
  it('treats the same number written three ways as one', () => {
    expect(normalizePhone('01712-345678')).toBe('01712345678')
    expect(normalizePhone('+8801712345678')).toBe('01712345678')
    expect(normalizePhone(' 01712345678 ')).toBe('01712345678')
  })

  it('returns null for empty input', () => {
    expect(normalizePhone('')).toBeNull()
    expect(normalizePhone(null)).toBeNull()
  })
})

describe('applyPaymentToBalance', () => {
  it('reduces due and raises paid', () => {
    expect(applyPaymentToBalance({ dueAmount: 1000, paidAmount: 200 }, 400)).toEqual({
      dueAmount: 600,
      paidAmount: 600,
      appliedToDue: 400,
    })
  })

  it('never drives due below zero on overpayment', () => {
    const result = applyPaymentToBalance({ dueAmount: 100, paidAmount: 0 }, 500)
    expect(result.dueAmount).toBe(0)
    expect(result.appliedToDue).toBe(100)
    // Cash actually left the business, so the full amount is still recorded.
    expect(result.paidAmount).toBe(500)
  })
})

describe('applyPurchaseToBalance', () => {
  it('adds the purchase due to the running balance', () => {
    expect(
      applyPurchaseToBalance({ dueAmount: 500, paidAmount: 100 }, { dueAmount: 250, paidAmount: 50 }),
    ).toEqual({ dueAmount: 750, paidAmount: 150 })
  })

  it('stays exact across many decimal purchases', () => {
    let balance = { dueAmount: 0, paidAmount: 0 }
    for (let i = 0; i < 300; i += 1) {
      balance = applyPurchaseToBalance(balance, { dueAmount: 0.1, paidAmount: 0 })
    }
    expect(balance.dueAmount).toBe(30)
  })
})

describe('splitStockableItems', () => {
  it('separates lines that can move stock from lines that cannot', () => {
    const { stockable, skipped } = splitStockableItems([
      { variantId: 'v1', sku: null },
      { variantId: null, sku: 'SKU-1' },
      { variantId: null, sku: null },
    ])
    expect(stockable).toHaveLength(2)
    expect(skipped).toHaveLength(1)
  })
})

describe('resolveExpectedAt', () => {
  const purchasedAt = new Date('2026-08-28T10:00:00.000Z')

  it('takes the typed date over the supplier lead time', () => {
    const eta = resolveExpectedAt({ expectedAt: '2026-09-05', purchasedAt, leadTimeDays: 3 })
    expect(eta?.toISOString().slice(0, 10)).toBe('2026-09-05')
  })

  it('derives one from the supplier lead time when none is typed', () => {
    const eta = resolveExpectedAt({ purchasedAt, leadTimeDays: 6 })
    expect(eta?.toISOString().slice(0, 10)).toBe('2026-09-03')
  })

  it('returns null rather than inventing a date', () => {
    expect(resolveExpectedAt({ purchasedAt })).toBeNull()
    expect(resolveExpectedAt({ purchasedAt, leadTimeDays: 0 })).toBeNull()
    expect(resolveExpectedAt({ expectedAt: 'not-a-date', purchasedAt, leadTimeDays: 6 })).toBeNull()
  })
})

describe('describeEta', () => {
  const now = new Date('2026-08-28T18:30:00.000Z')

  it('counts whole days, not hours, so an evening entry is not a day early', () => {
    expect(describeEta('2026-08-29T02:00:00.000Z', now)).toEqual({ state: 'due', days: 1 })
  })

  it('reads today as today and a passed date as late', () => {
    expect(describeEta('2026-08-28T06:00:00.000Z', now)).toEqual({ state: 'today', days: 0 })
    expect(describeEta('2026-08-24T06:00:00.000Z', now)).toEqual({ state: 'late', days: 4 })
  })

  it('reports no state when the ETA was never captured', () => {
    expect(describeEta(null, now)).toEqual({ state: 'none', days: 0 })
    expect(describeEta('rubbish', now)).toEqual({ state: 'none', days: 0 })
  })
})

describe('reversePurchaseFromBalance', () => {
  it('removes exactly what the purchase still contributes', () => {
    const balance = reversePurchaseFromBalance(
      { dueAmount: 12_000, paidAmount: 8_000 },
      { dueAmount: 3_500, paidAmount: 1_500 },
    )
    expect(balance).toEqual({ dueAmount: 8_500, paidAmount: 6_500 })
  })

  it('never drives a balance negative', () => {
    const balance = reversePurchaseFromBalance(
      { dueAmount: 100, paidAmount: 0 },
      { dueAmount: 900, paidAmount: 400 },
    )
    expect(balance).toEqual({ dueAmount: 0, paidAmount: 0 })
  })
})

describe('reverseStockDelta', () => {
  it('takes the whole quantity back when it is still on the shelf', () => {
    expect(reverseStockDelta(30, 12)).toEqual({ quantityAfter: 18, removed: 12 })
  })

  it('removes only what is there when some was already sold', () => {
    expect(reverseStockDelta(4, 12)).toEqual({ quantityAfter: 0, removed: 4 })
  })
})
