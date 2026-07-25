import { CourierService } from './courier.service'
import type { OrderStatusService } from '../orders/order-status.service'
import type { PrismaService } from '../../common/prisma.service'
import type { RedisService } from '../../common/redis.service'

jest.mock('../../common/redis-lock.util', () => ({
  withDistributedLock: jest.fn(async (_redis: unknown, _key: string, _ttl: number, fn: () => unknown) =>
    fn(),
  ),
}))

jest.mock('../../common/noop-queue.providers', () => ({
  redisQueuesEnabled: () => false,
}))

describe('CourierService booking honesty', () => {
  const applyStatusChange = jest.fn()
  const orderStatus = { applyStatusChange } as unknown as OrderStatusService

  const order = {
    id: 'ord-1',
    storeId: 'store-1',
    invoiceNumber: 'SPL-1001',
    status: 'CONFIRMED',
    paymentMethod: 'CASH_ON_DELIVERY',
    total: 1200,
    deliveryCharge: 60,
    shippingName: 'Buyer',
    shippingPhone: '01700000000',
    shippingAddress: 'Dhaka',
    shippingCity: 'Dhaka',
    shippingDistrict: 'Dhaka',
    items: [],
    courier: null,
  }

  function buildService(opts: {
    simulated?: boolean
    consignmentId?: string
    existingConsignment?: string | null
  }) {
    const upsert = jest.fn().mockResolvedValue({})
    const prisma = {
      order: {
        findUnique: jest.fn().mockResolvedValue({
          ...order,
          courier: opts.existingConsignment
            ? { consignmentId: opts.existingConsignment, trackingCode: 'T1', trackingUrl: null }
            : null,
        }),
      },
      courierShipment: {
        upsert,
        findUnique: jest.fn().mockResolvedValue(
          opts.existingConsignment
            ? {
                consignmentId: opts.existingConsignment,
                trackingCode: 'T1',
                trackingUrl: null,
                status: 'BOOKED',
              }
            : null,
        ),
      },
    } as unknown as PrismaService

    const steadfast = {
      createParcel: jest.fn().mockResolvedValue({
        success: true,
        simulated: Boolean(opts.simulated),
        consignmentId: opts.consignmentId ?? (opts.simulated ? 'DEV-SF-1' : 'SF-LIVE-1'),
        trackingCode: 'TRK-1',
        trackingUrl: 'https://steadfast.com.bd/t/1',
      }),
    }

    const service = new CourierService(
      prisma,
      steadfast as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { notifyAdmin: jest.fn().mockResolvedValue(undefined) } as never,
      null,
      { add: jest.fn() } as never,
      { isReady: () => true } as unknown as RedisService,
      orderStatus,
    )

    ;(service as unknown as { selectProvider: () => string }).selectProvider = () => 'STEADFAST'

    return { service, upsert, applyStatusChange, steadfast }
  }

  beforeEach(() => {
    applyStatusChange.mockReset()
    applyStatusChange.mockResolvedValue({ ...order, status: 'COURIER_BOOKED' })
  })

  it('never persists simulated / DEV-* as BOOKED', async () => {
    const { service, upsert } = buildService({ simulated: true, consignmentId: 'DEV-SF-99' })
    const result = await service.bookCourier('ord-1')
    expect(result.success).toBe(false)
    expect(result.simulated).toBe(true)
    expect(upsert).not.toHaveBeenCalled()
    expect(applyStatusChange).not.toHaveBeenCalled()
  })

  it('persists live booking and applies COURIER_BOOKED via OrderStatusService', async () => {
    const { service, upsert } = buildService({ simulated: false, consignmentId: 'SF-LIVE-42' })
    const result = await service.bookCourier('ord-1')
    expect(result.success).toBe(true)
    expect(upsert).toHaveBeenCalled()
    expect(applyStatusChange).toHaveBeenCalledWith(
      'ord-1',
      'COURIER_BOOKED',
      expect.stringContaining('STEADFAST'),
      'store-1',
    )
  })

  it('returns alreadyBooked when consignment exists', async () => {
    const { service, upsert } = buildService({ existingConsignment: 'SF-EXISTING' })
    const result = await service.bookCourier('ord-1')
    expect(result.alreadyBooked).toBe(true)
    expect(result.consignmentId).toBe('SF-EXISTING')
    expect(upsert).not.toHaveBeenCalled()
  })
})

describe('courier-save DEV-* honesty (mirrors admin helper)', () => {
  function isRealCourierBooking(r: {
    success: boolean
    consignmentId?: string
    simulated?: boolean
  }): boolean {
    return Boolean(
      r.success && r.consignmentId && !r.consignmentId.startsWith('DEV-') && !r.simulated,
    )
  }

  it('rejects DEV-* and simulated', () => {
    expect(isRealCourierBooking({ success: true, consignmentId: 'DEV-SF-1' })).toBe(false)
    expect(isRealCourierBooking({ success: true, consignmentId: 'SF-1', simulated: true })).toBe(false)
  })

  it('accepts live consignments', () => {
    expect(isRealCourierBooking({ success: true, consignmentId: 'SF-LIVE-9' })).toBe(true)
  })
})
