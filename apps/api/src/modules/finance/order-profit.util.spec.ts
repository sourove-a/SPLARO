import { allocateAdsRevenueWeighted, computeOrderProfit } from './order-profit.util'

describe('computeOrderProfit', () => {
  it('does not invent COGS from selling price when costPrice is missing', () => {
    const result = computeOrderProfit({
      grossRevenue: 2000,
      discount: 0,
      courierCost: 80,
      packagingCostPerOrder: 20,
      paymentFeePercent: 0,
      isCod: true,
      returnLoss: 0,
      allocatedAdCost: 0,
      lines: [{ unitPrice: 2000, quantity: 1, productCostPrice: null }],
    })

    expect(result.productCost).toBe(0)
    expect(result.incompleteReasons).toContain('missing_cost')
    expect(result.netProfit).toBe(2000 - 20 - 80)
  })

  it('uses packaging setting instead of a silent 15 taka default', () => {
    const unset = computeOrderProfit({
      grossRevenue: 1000,
      discount: 0,
      courierCost: 0,
      packagingCostPerOrder: 0,
      paymentFeePercent: 0,
      isCod: true,
      returnLoss: 0,
      allocatedAdCost: 0,
      lines: [{ unitPrice: 1000, quantity: 1, productCostPrice: 400 }],
    })
    expect(unset.packagingCost).toBe(0)
    expect(unset.incompleteReasons).toContain('packaging_unset')

    const set = computeOrderProfit({
      ...{
        grossRevenue: 1000,
        discount: 0,
        courierCost: 0,
        packagingCostPerOrder: 25,
        paymentFeePercent: 0,
        isCod: true,
        returnLoss: 0,
        allocatedAdCost: 0,
        lines: [{ unitPrice: 1000, quantity: 1, productCostPrice: 400 }],
      },
    })
    expect(set.packagingCost).toBe(25)
    expect(set.incompleteReasons).not.toContain('packaging_unset')
    expect(set.netProfit).toBe(1000 - 400 - 25)
  })

  it('charges payment fee only on non-COD', () => {
    const base = {
      grossRevenue: 1000,
      discount: 0,
      courierCost: 0,
      packagingCostPerOrder: 0,
      returnLoss: 0,
      allocatedAdCost: 0,
      lines: [{ unitPrice: 1000, quantity: 1, productCostPrice: 500 }],
    }
    const cod = computeOrderProfit({ ...base, paymentFeePercent: 2.5, isCod: true })
    const digital = computeOrderProfit({ ...base, paymentFeePercent: 2.5, isCod: false })
    expect(cod.paymentGatewayFee).toBe(0)
    expect(digital.paymentGatewayFee).toBe(25)
  })
})

describe('allocateAdsRevenueWeighted', () => {
  it('splits ad spend by revenue weight', () => {
    expect(allocateAdsRevenueWeighted(100, [300, 100])).toEqual([75, 25])
  })

  it('returns zeros when there is no spend or revenue', () => {
    expect(allocateAdsRevenueWeighted(0, [100, 50])).toEqual([0, 0])
    expect(allocateAdsRevenueWeighted(80, [0, 0])).toEqual([0, 0])
  })
})
