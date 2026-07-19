import type { PrismaService } from '../../common/prisma.service'
import type { OrderSideEffectsQueueService } from './order-side-effects-queue.service'
import { CommerceEventOutboxService } from './commerce-event-outbox.service'

const payload = {
  storeId: 'store-1',
  orderId: 'order-1',
  customerEmail: 'buyer@example.com',
  meta: { total: 1200, phone: '01700000000' },
}

describe('CommerceEventOutboxService', () => {
  it('writes order placed into the same transaction with a stable dedupe key', async () => {
    const tx = {
      commerceEventOutbox: { upsert: jest.fn().mockResolvedValue({}) },
    }
    const service = new CommerceEventOutboxService(
      {} as PrismaService,
      {} as OrderSideEffectsQueueService,
    )

    await service.enqueueOrderPlaced(tx as never, payload)

    expect(tx.commerceEventOutbox.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { dedupeKey: 'order-placed:order-1' },
        create: expect.objectContaining({
          eventType: 'ORDER_PLACED',
          dedupeKey: 'order-placed:order-1',
        }),
      }),
    )
  })

  it('dispatches a claimed event and marks it sent', async () => {
    const event = {
      id: 'event-1',
      orderId: 'order-1',
      eventType: 'ORDER_PLACED',
      payload,
      attempts: 0,
    }
    const prisma = {
      commerceEventOutbox: {
        findFirst: jest.fn().mockResolvedValue(event),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn().mockResolvedValue(event),
        update: jest.fn().mockResolvedValue({}),
      },
    } as unknown as PrismaService
    const sideEffects = {
      enqueueOrderPlaced: jest.fn().mockResolvedValue(undefined),
    } as unknown as OrderSideEffectsQueueService
    const service = new CommerceEventOutboxService(prisma, sideEffects)

    await service.dispatchForOrder('order-1')

    expect(sideEffects.enqueueOrderPlaced).toHaveBeenCalledWith(payload)
    expect(prisma.commerceEventOutbox.update).toHaveBeenCalledWith({
      where: { id: 'event-1' },
      data: { status: 'SENT', processedAt: expect.any(Date), lastError: null },
    })
  })
})
