import { BadRequestException, NotFoundException } from '@nestjs/common'
import type { PrismaService } from '../../common/prisma.service'
import { DashboardController } from './dashboard.controller'

jest.mock('../../common/store.util', () => ({
  resolveStoreId: jest.fn().mockResolvedValue('store-1'),
}))

function buildController(
  opts: { goal?: number; todayTotal?: number; todayOrders?: number; noSettings?: boolean } = {},
) {
  const update = jest.fn().mockResolvedValue({})
  const prisma = {
    siteSettings: {
      findUnique: jest.fn().mockResolvedValue(
        opts.noSettings
          ? null
          : {
              storefrontConfig:
                opts.goal === undefined ? {} : { dailyRevenueGoal: opts.goal },
            },
      ),
      update,
    },
    order: {
      aggregate: jest.fn().mockResolvedValue({
        _sum: { total: opts.todayTotal ?? 0 },
        _count: { id: opts.todayOrders ?? 0 },
      }),
    },
  } as unknown as PrismaService

  return {
    controller: new DashboardController({} as never, prisma, {} as never),
    prisma,
    update,
  }
}

describe('DashboardController daily goal', () => {
  it('reports no goal when nobody has set one', async () => {
    const { controller } = buildController({ todayTotal: 12_000, todayOrders: 3 })

    await expect(controller.dailyGoal('store-1')).resolves.toEqual({
      goal: null,
      achieved: 12_000,
      orders: 3,
      percent: null,
      remaining: null,
    })
  })

  it('computes progress against the stored goal', async () => {
    const { controller } = buildController({
      goal: 150_000,
      todayTotal: 124_600,
      todayOrders: 34,
    })

    await expect(controller.dailyGoal('store-1')).resolves.toEqual({
      goal: 150_000,
      achieved: 124_600,
      orders: 34,
      percent: 83,
      remaining: 25_400,
    })
  })

  it('lets a beaten target read above 100% but never owes a negative remainder', async () => {
    const { controller } = buildController({ goal: 100_000, todayTotal: 120_000 })
    const result = await controller.dailyGoal('store-1')

    expect(result.percent).toBe(120)
    expect(result.remaining).toBe(0)
  })

  it('counts only today and excludes cancelled orders', async () => {
    const { controller, prisma } = buildController({ goal: 1_000 })
    await controller.dailyGoal('store-1')

    const where = (prisma as unknown as { order: { aggregate: jest.Mock } }).order.aggregate.mock
      .calls[0]![0].where
    expect(where.status).toEqual({ notIn: ['CANCELLED'] })
    const from = where.createdAt.gte as Date
    expect(from.getHours()).toBe(0)
    expect(from.getMinutes()).toBe(0)
    expect(from.toDateString()).toBe(new Date().toDateString())
  })

  it('saves a rounded goal without disturbing the rest of the config', async () => {
    const { controller, update } = buildController({ goal: 100 })
    await expect(controller.setDailyGoal('store-1', { goal: 149_999.6 })).resolves.toEqual({
      goal: 150_000,
    })

    const written = update.mock.calls[0]![0].data.storefrontConfig as Record<string, unknown>
    expect(written.dailyRevenueGoal).toBe(150_000)
    expect(written.headerNav).toBeDefined()
  })

  it('clears the goal when sent null', async () => {
    const { controller, update } = buildController({ goal: 150_000 })
    await expect(controller.setDailyGoal('store-1', { goal: null })).resolves.toEqual({
      goal: null,
    })
    expect(
      (update.mock.calls[0]![0].data.storefrontConfig as Record<string, unknown>)
        .dailyRevenueGoal,
    ).toBeUndefined()
  })

  it.each([[-1], [Number.NaN], [Number.POSITIVE_INFINITY], ['150000' as unknown as number]])(
    'rejects %p as a goal',
    async (bad) => {
      const { controller, update } = buildController()
      await expect(controller.setDailyGoal('store-1', { goal: bad })).rejects.toBeInstanceOf(
        BadRequestException,
      )
      expect(update).not.toHaveBeenCalled()
    },
  )

  it('404s when the store has no settings row to write into', async () => {
    const { controller } = buildController({ noSettings: true })
    await expect(controller.setDailyGoal('store-1', { goal: 1_000 })).rejects.toBeInstanceOf(
      NotFoundException,
    )
  })
})
