import { OrderSideEffectsQueueService } from './order-side-effects-queue.service'
import type { OrderEventsService } from './order-events.service'
import type { MetaCapiService } from '../marketing/meta-capi.service'

const payload = {
  storeId: 'store-1',
  orderId: 'order-1',
  customerEmail: 'buyer@example.com',
  meta: { total: 1200, phone: '01700000000' },
}

describe('OrderSideEffectsQueueService', () => {
  it('runs order-placed side effects inline instead of parking them on Redis', async () => {
    const onOrderPlaced = jest.fn().mockResolvedValue(undefined)
    const trackPurchase = jest.fn().mockResolvedValue(undefined)
    const service = new OrderSideEffectsQueueService(
      { trackPurchase } as unknown as MetaCapiService,
      { onOrderPlaced } as unknown as OrderEventsService,
    )

    await service.enqueueOrderPlaced(payload)

    expect(onOrderPlaced).toHaveBeenCalledWith('store-1', 'order-1', 'buyer@example.com')
    expect(trackPurchase).toHaveBeenCalled()
  })
})
