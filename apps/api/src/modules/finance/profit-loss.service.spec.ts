import { ProfitLossService } from './profit-loss.service'
import type { PrismaService } from '../../common/prisma.service'
import type { PartnerTransactionsService } from './partners.service'

describe('ProfitLossService.getSummary', () => {
  it('aggregates in one query and does not load partners or rows', async () => {
    const aggregate = jest.fn().mockResolvedValue({
      _count: { _all: 0 },
      _sum: {},
    })
    const findMany = jest.fn()
    const prisma = {
      profitCalculation: { aggregate, findMany },
      partner: { findMany },
    } as unknown as PrismaService
    const service = new ProfitLossService(prisma, {} as PartnerTransactionsService)

    const from = new Date('2026-08-01T00:00:00.000Z')
    const to = new Date('2026-08-20T00:00:00.000Z')
    const result = await service.getSummary('store-1', from, to)

    expect(aggregate).toHaveBeenCalledTimes(1)
    expect(findMany).not.toHaveBeenCalled()
    expect(result.orderCount).toBe(0)
    expect(result.totals).toEqual({
      grossRevenue: 0,
      productCost: 0,
      courierCost: 0,
      packagingCost: 0,
      paymentGatewayFee: 0,
      discount: 0,
      returnLoss: 0,
      allocatedAdCost: 0,
      netProfit: 0,
    })
    expect(result).not.toHaveProperty('timeline')
    expect(result).not.toHaveProperty('partners')
  })
})
