import { BadRequestException } from '@nestjs/common'
import { AutomationService } from './automation.service'
import type { OrderStatusService } from '../orders/order-status.service'
import type { PrismaService } from '../../common/prisma.service'

describe('AutomationService UPDATE_ORDER_STATUS', () => {
  const applyStatusChange = jest.fn()
  const orderStatus = { applyStatusChange } as unknown as OrderStatusService
  const prisma = {
    automationRule: { findMany: jest.fn(), update: jest.fn() },
    automationLog: { create: jest.fn().mockResolvedValue({}) },
  } as unknown as PrismaService

  beforeEach(() => {
    applyStatusChange.mockReset()
    applyStatusChange.mockResolvedValue({ id: 'ord-1', status: 'CONFIRMED' })
    ;(prisma.automationRule.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'rule-1',
        name: 'Confirm on pay',
        conditions: [],
        actions: [
          {
            id: 'act-1',
            action: 'UPDATE_ORDER_STATUS',
            params: { status: 'CONFIRMED' },
            sortOrder: 0,
          },
        ],
      },
    ])
    ;(prisma.automationRule.update as jest.Mock).mockResolvedValue({})
  })

  it('routes valid status through OrderStatusService.applyStatusChange', async () => {
    const service = new AutomationService(prisma, orderStatus)
    await service.runTrigger('store-1', 'ORDER_PLACED' as never, {
      orderId: 'ord-1',
      storeId: 'store-1',
    })
    expect(applyStatusChange).toHaveBeenCalledWith(
      'ord-1',
      'CONFIRMED',
      'Automation rule rule-1',
      'store-1',
      { notePrefix: 'Automation: ' },
    )
  })

  it('rejects unknown status and does not call applyStatusChange', async () => {
    ;(prisma.automationRule.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'rule-2',
        name: 'Bad status',
        conditions: [],
        actions: [
          {
            id: 'act-2',
            action: 'UPDATE_ORDER_STATUS',
            params: { status: 'NOT_A_REAL_STATUS' },
            sortOrder: 0,
          },
        ],
      },
    ])
    const service = new AutomationService(prisma, orderStatus)
    await service.runTrigger('store-1', 'ORDER_PLACED' as never, { orderId: 'ord-1' })
    expect(applyStatusChange).not.toHaveBeenCalled()
    expect(prisma.automationLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ success: false }),
      }),
    )
  })

  it('surfaces transition failures from OrderStatusService', async () => {
    applyStatusChange.mockRejectedValue(
      new BadRequestException('Cannot change order from DELIVERED to PENDING'),
    )
    const service = new AutomationService(prisma, orderStatus)
    await service.runTrigger('store-1', 'ORDER_PLACED' as never, {
      orderId: 'ord-1',
      storeId: 'store-1',
    })
    expect(prisma.automationLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          success: false,
          errorMsg: expect.stringContaining('Cannot change order'),
        }),
      }),
    )
  })
})
