import { BadRequestException, NotFoundException } from '@nestjs/common'
import { FulfillmentService } from './fulfillment.service'
import { generateProductStickersHtml } from './label.template'
import type { OrderStatusService } from '../orders/order-status.service'
import type { PrismaService } from '../../common/prisma.service'

const baseOrder = {
  id: 'ord-1',
  storeId: 'store-1',
  invoiceNumber: 'SPL-1001',
  shippingName: 'Test Buyer',
  shippingPhone: '01700000000',
  shippingCity: 'Dhaka',
  shippingDistrict: 'Dhaka',
  shippingAddress: 'House 1',
  shippingDivision: 'Dhaka',
  shippingPostal: null,
  paymentMethod: 'CASH_ON_DELIVERY',
  paymentStatus: 'UNPAID',
  total: 1200,
  isCodRisk: false,
  status: 'PROCESSING' as string,
  items: [{ id: 'li-1', quantity: 2, productName: 'Polo', sku: 'SPL-POLO' }],
  courier: null,
}

describe('FulfillmentService.scan', () => {
  const applyStatusChange = jest.fn()
  const orderStatus = { applyStatusChange } as unknown as OrderStatusService

  function makePrisma(order: typeof baseOrder | null) {
    return {
      order: {
        findFirst: jest.fn().mockResolvedValue(order),
      },
      courierShipment: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      orderStatusHistory: {
        count: jest.fn().mockResolvedValue(0),
      },
    } as unknown as PrismaService
  }

  beforeEach(() => {
    applyStatusChange.mockReset()
  })

  it('packs via OrderStatusService on happy path', async () => {
    applyStatusChange.mockResolvedValue({
      ...baseOrder,
      status: 'PACKED',
    })
    const service = new FulfillmentService(makePrisma(baseOrder), orderStatus)
    const result = await service.scan('SPL-1001', 'pack', 'store-1')
    expect(applyStatusChange).toHaveBeenCalledWith(
      'ord-1',
      'PACKED',
      expect.stringContaining('PACKED'),
      'store-1',
    )
    expect(result).toMatchObject({
      ok: true,
      previousStatus: 'PROCESSING',
      status: 'PACKED',
      itemCount: 2,
    })
  })

  it('dispatches to SHIPPED', async () => {
    const packed = { ...baseOrder, status: 'PACKED' as const }
    applyStatusChange.mockResolvedValue({ ...packed, status: 'SHIPPED' })
    const service = new FulfillmentService(makePrisma(packed), orderStatus)
    const result = await service.scan('SPL-1001', 'dispatch')
    expect(applyStatusChange).toHaveBeenCalledWith(
      'ord-1',
      'SHIPPED',
      expect.stringContaining('SHIPPED'),
      undefined,
    )
    expect(result.status).toBe('SHIPPED')
  })

  it('returns Already PACKED without second history write', async () => {
    const packed = { ...baseOrder, status: 'PACKED' as const }
    const service = new FulfillmentService(makePrisma(packed), orderStatus)
    const result = await service.scan('SPL-1001', 'pack')
    expect(applyStatusChange).not.toHaveBeenCalled()
    expect(result.message).toBe('Already PACKED')
    expect(result.previousStatus).toBe('PACKED')
    expect(result.status).toBe('PACKED')
  })

  it('rejects invalid action', async () => {
    const service = new FulfillmentService(makePrisma(baseOrder), orderStatus)
    await expect(service.scan('SPL-1001', 'nope' as never)).rejects.toBeInstanceOf(
      BadRequestException,
    )
  })

  it('surfaces transition rejection from OrderStatusService', async () => {
    applyStatusChange.mockRejectedValue(
      new BadRequestException('Cannot change order from CANCELLED to PACKED'),
    )
    const cancelled = { ...baseOrder, status: 'CANCELLED' as const }
    const service = new FulfillmentService(makePrisma(cancelled), orderStatus)
    await expect(service.scan('SPL-1001', 'pack')).rejects.toBeInstanceOf(BadRequestException)
  })

  it('resolves by tracking code via courierShipment', async () => {
    const prisma = {
      order: { findFirst: jest.fn().mockResolvedValue(null) },
      courierShipment: {
        findFirst: jest.fn().mockResolvedValue({ order: baseOrder }),
      },
    } as unknown as PrismaService
    applyStatusChange.mockResolvedValue({ ...baseOrder, status: 'PACKED' })
    const service = new FulfillmentService(prisma, orderStatus)
    const result = await service.scan('TRK-999', 'pack')
    expect(prisma.courierShipment.findFirst).toHaveBeenCalled()
    expect(result.invoiceNumber).toBe('SPL-1001')
  })

  it('throws when code not found', async () => {
    const prisma = {
      order: { findFirst: jest.fn().mockResolvedValue(null) },
      courierShipment: { findFirst: jest.fn().mockResolvedValue(null) },
    } as unknown as PrismaService
    const service = new FulfillmentService(prisma, orderStatus)
    await expect(service.scan('MISSING', 'pack')).rejects.toBeInstanceOf(NotFoundException)
  })
})

describe('FulfillmentService.toStationOrder', () => {
  it('exposes variant barcode for pick-list scans', () => {
    const service = new FulfillmentService(
      {} as PrismaService,
      {} as OrderStatusService,
    )
    const station = service.toStationOrder({
      ...baseOrder,
      items: [
        {
          id: 'li-1',
          quantity: 2,
          productName: 'Polo',
          sku: 'SPL-POLO',
          variant: {
            sku: 'SPL-POLO-M',
            barcode: '8901234567890',
            size: 'M',
            colorName: 'Black',
          },
          product: { name: 'Polo', sku: 'SPL-POLO', barcode: null, images: [] },
        },
      ],
    } as never)
    expect(station.items[0]).toMatchObject({
      sku: 'SPL-POLO',
      barcode: '8901234567890',
      size: 'M',
      color: 'Black',
    })
  })
})

describe('product stickers', () => {
  it('encodes SKU/barcode instead of invoice', () => {
    const html = generateProductStickersHtml(
      [
        {
          invoiceNumber: 'SPL-1001',
          productName: 'Polo',
          sku: 'SPL-POLO-M',
          barcode: '8901234567890',
          scanCode: '8901234567890',
          size: 'M',
          color: 'Black',
          quantity: 1,
          autoPrint: false,
        },
      ],
      false,
    )
    expect(html).toContain('8901234567890')
    expect(html).toContain('SKU: SPL-POLO-M')
    expect(html).toContain('BC: 8901234567890')
  })
})

describe('FulfillmentService.todayCounts', () => {
  it('returns honest zeros without all-time fallback', async () => {
    const prisma = {
      orderStatusHistory: {
        count: jest.fn().mockResolvedValue(0),
      },
      order: {
        count: jest.fn(),
      },
    } as unknown as PrismaService
    const service = new FulfillmentService(prisma, {} as OrderStatusService)
    const counts = await service.todayCounts('store-1')
    expect(counts).toEqual({ packed: 0, shipped: 0 })
    expect(prisma.order.count).not.toHaveBeenCalled()
  })
})
