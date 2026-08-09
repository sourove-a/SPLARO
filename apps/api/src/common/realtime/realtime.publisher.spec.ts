import { RealtimePublisher } from './realtime.publisher'
import type { RealtimeBusService } from './realtime-bus.service'

describe('RealtimePublisher', () => {
  it('publishes sanitized payloads to order + admin channels after seq assign', async () => {
    const published: Array<{ channel: string; payload: string }> = []
    const bus = {
      nextSeq: jest.fn().mockResolvedValue(7),
      publish: jest.fn(async (channel: string, payload: string) => {
        published.push({ channel, payload })
      }),
    } as unknown as RealtimeBusService
    const publisher = new RealtimePublisher(bus)

    await publisher.publishOrderEvent({
      type: 'order.status_changed',
      orderId: 'ord_1',
      storeId: 'store_1',
      invoiceNumber: 'SPL-1001',
      status: 'PACKED',
      paymentStatus: 'UNPAID',
      updatedAt: '2026-08-10T05:00:00.000Z',
    })

    expect(bus.nextSeq).toHaveBeenCalledWith('ord_1')
    expect(published).toHaveLength(2)
    expect(published[0]?.channel).toBe('splaro:rt:order:ord_1')
    expect(published[1]?.channel).toBe('splaro:rt:admin:store_1:orders')
    const body = JSON.parse(published[0]?.payload ?? '{}') as Record<string, unknown>
    expect(body).toEqual({
      type: 'order.status_changed',
      orderId: 'ord_1',
      invoiceNumber: 'SPL-1001',
      status: 'PACKED',
      paymentStatus: 'UNPAID',
      updatedAt: '2026-08-10T05:00:00.000Z',
      seq: 7,
    })
    expect(body.shippingPhone).toBeUndefined()
  })

  it('skips unsafe ids without publishing', async () => {
    const bus = {
      nextSeq: jest.fn(),
      publish: jest.fn(),
    } as unknown as RealtimeBusService
    const publisher = new RealtimePublisher(bus)
    await publisher.publishOrderEvent({
      type: 'order.created',
      orderId: 'ord *',
      storeId: 'store_1',
    })
    expect(bus.nextSeq).not.toHaveBeenCalled()
    expect(bus.publish).not.toHaveBeenCalled()
  })
})
