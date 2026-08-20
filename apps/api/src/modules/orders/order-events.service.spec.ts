import { OrderEventsService } from './order-events.service'
import type { PrismaService } from '../../common/prisma.service'
import type { ModuleRef } from '@nestjs/core'

describe('OrderEventsService.onOrderPlaced', () => {
  it('creates Notification Center + Telegram fan-out for the new order', async () => {
    const onOrderPlaced = jest.fn().mockResolvedValue(undefined)
    const prisma = {
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'ord-1',
          invoiceNumber: 'SPL-1001',
          storeId: 'store-1',
          status: 'PENDING',
          paymentStatus: 'PENDING',
          updatedAt: new Date(),
          shippingName: 'SOUROVE AHAMMED',
          shippingPhone: '01700000000',
          shippingCity: 'Dhaka',
          total: 2500,
          customerId: null,
          isCodRisk: false,
          paymentMethod: 'CASH_ON_DELIVERY',
          items: [],
          customer: null,
        }),
      },
    } as unknown as PrismaService

    const service = new OrderEventsService(
      prisma,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      { get: () => ({ onOrderPlaced }) } as unknown as ModuleRef,
    )

    await service.onOrderPlaced('store-1', 'ord-1', 'sourove@example.com')
    expect(onOrderPlaced).toHaveBeenCalledWith('store-1', 'ord-1', 'sourove@example.com')
  })

  it('writes an IN_APP Notification Center row when fan-out cannot be resolved', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'log-1' })
    const prisma = {
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'ord-1',
          invoiceNumber: 'SPL-1001',
          storeId: 'store-1',
          status: 'PENDING',
          paymentStatus: 'PENDING',
          updatedAt: new Date(),
          shippingName: 'SOUROVE AHAMMED',
          shippingPhone: '01700000000',
          shippingCity: 'Dhaka',
          total: 2500,
          customerId: null,
          isCodRisk: false,
          paymentMethod: 'CASH_ON_DELIVERY',
          items: [],
          customer: null,
        }),
      },
      notificationDeliveryLog: { create },
    } as unknown as PrismaService

    const service = new OrderEventsService(
      prisma,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      { get: () => undefined } as unknown as ModuleRef,
    )

    await service.onOrderPlaced('store-1', 'ord-1')
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        channel: 'IN_APP',
        subject: 'New order · SPL-1001',
        status: 'DELIVERED',
        level: 'critical',
      }),
    })
  })
})
