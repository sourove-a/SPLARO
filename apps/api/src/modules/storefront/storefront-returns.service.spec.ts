import { BadRequestException, NotFoundException } from '@nestjs/common'
import { StorefrontReturnsService, DEFAULT_RETURN_WINDOW_DAYS } from './storefront-returns.service'

const STORE = 'store-1'
const CUSTOMER = 'cust-1'

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
}

type OrderOverrides = {
  status?: string
  deliveredAt?: Date | null
  items?: { id: string; quantity: number }[]
  rmas?: { items: { orderItemId: string; quantity: number }[] }[]
}

function buildService(order: OrderOverrides | null) {
  const created = { calls: [] as unknown[] }
  const prisma = {
    order: {
      findFirst: jest.fn().mockResolvedValue(
        order
          ? {
              id: 'order-1',
              invoiceNumber: 'SPL-1001',
              status: order.status ?? 'DELIVERED',
              deliveredAt: order.deliveredAt === undefined ? daysAgo(1) : order.deliveredAt,
              items: (order.items ?? [{ id: 'item-1', quantity: 2 }]).map((item) => ({
                id: item.id,
                productName: `Product ${item.id}`,
                variantName: null,
                image: null,
                quantity: item.quantity,
              })),
              rmas: order.rmas ?? [],
            }
          : null,
      ),
    },
    rMA: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(async (args: { data: unknown }) => {
        created.calls.push(args.data)
        return {
          id: 'rma-1',
          rmaNumber: 'RMA-TEST',
          type: 'RETURN',
          status: 'REQUESTED',
          reason: 'Wrong size',
          description: null,
          images: [],
          refundAmount: null,
          resolvedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          order: { id: 'order-1', invoiceNumber: 'SPL-1001' },
          items: [
            {
              orderItemId: 'item-1',
              quantity: 1,
              orderItem: {
                id: 'item-1',
                productName: 'Product item-1',
                variantName: null,
                image: null,
              },
            },
          ],
          statusHistory: [{ status: 'REQUESTED', note: 'Opened', createdAt: new Date() }],
        }
      }),
    },
  }

  return {
    service: new StorefrontReturnsService(prisma as never),
    prisma,
    created,
  }
}

describe('StorefrontReturnsService', () => {
  it('refuses an order that belongs to another customer', async () => {
    const { service, prisma } = buildService(null)
    await expect(service.eligibility(STORE, CUSTOMER, 'order-1')).rejects.toBeInstanceOf(
      NotFoundException,
    )
    expect(prisma.order.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'order-1', storeId: STORE, customerId: CUSTOMER },
      }),
    )
  })

  it('marks an undelivered order ineligible', async () => {
    const { service } = buildService({ status: 'SHIPPED', deliveredAt: null })
    const result = await service.eligibility(STORE, CUSTOMER, 'order-1')
    expect(result.eligible).toBe(false)
    expect(result.reason).toBe('NOT_DELIVERED')
  })

  it('closes the window once the return period has passed', async () => {
    const { service } = buildService({ deliveredAt: daysAgo(DEFAULT_RETURN_WINDOW_DAYS + 1) })
    const result = await service.eligibility(STORE, CUSTOMER, 'order-1')
    expect(result.eligible).toBe(false)
    expect(result.reason).toBe('WINDOW_CLOSED')
  })

  it('subtracts quantities already claimed by an open RMA', async () => {
    const { service } = buildService({
      items: [{ id: 'item-1', quantity: 3 }],
      rmas: [{ items: [{ orderItemId: 'item-1', quantity: 2 }] }],
    })
    const result = await service.eligibility(STORE, CUSTOMER, 'order-1')
    expect(result.items[0]).toMatchObject({ orderedQuantity: 3, returnableQuantity: 1 })
  })

  it('reports nothing returnable when every unit is already claimed', async () => {
    const { service } = buildService({
      items: [{ id: 'item-1', quantity: 2 }],
      rmas: [{ items: [{ orderItemId: 'item-1', quantity: 2 }] }],
    })
    const result = await service.eligibility(STORE, CUSTOMER, 'order-1')
    expect(result.reason).toBe('NOTHING_RETURNABLE')
  })

  it('rejects a quantity above what is still returnable', async () => {
    const { service } = buildService({
      items: [{ id: 'item-1', quantity: 3 }],
      rmas: [{ items: [{ orderItemId: 'item-1', quantity: 2 }] }],
    })
    await expect(
      service.create(STORE, CUSTOMER, {
        orderId: 'order-1',
        reason: 'Wrong size',
        items: [{ orderItemId: 'item-1', quantity: 2 }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('rejects an item that is not on the order', async () => {
    const { service } = buildService({ items: [{ id: 'item-1', quantity: 1 }] })
    await expect(
      service.create(STORE, CUSTOMER, {
        orderId: 'order-1',
        reason: 'Wrong size',
        items: [{ orderItemId: 'item-someone-elses', quantity: 1 }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('rejects REPAIR, which stays an admin-side flow', async () => {
    const { service } = buildService({ items: [{ id: 'item-1', quantity: 1 }] })
    await expect(
      service.create(STORE, CUSTOMER, {
        orderId: 'order-1',
        type: 'REPAIR',
        reason: 'Wrong size',
        items: [{ orderItemId: 'item-1', quantity: 1 }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('files the RMA against the signed-in customer with its items', async () => {
    const { service, created } = buildService({ items: [{ id: 'item-1', quantity: 2 }] })
    const result = await service.create(STORE, CUSTOMER, {
      orderId: 'order-1',
      reason: 'Wrong size',
      items: [{ orderItemId: 'item-1', quantity: 1 }],
    })

    expect(result.rmaNumber).toBe('RMA-TEST')
    expect(created.calls[0]).toMatchObject({
      storeId: STORE,
      customerId: CUSTOMER,
      orderId: 'order-1',
      type: 'RETURN',
      reason: 'Wrong size',
      items: { create: [{ orderItemId: 'item-1', quantity: 1 }] },
    })
  })

  it('sums repeated lines for the same item before checking the cap', async () => {
    const { service } = buildService({ items: [{ id: 'item-1', quantity: 2 }] })
    await expect(
      service.create(STORE, CUSTOMER, {
        orderId: 'order-1',
        reason: 'Wrong size',
        items: [
          { orderItemId: 'item-1', quantity: 1 },
          { orderItemId: 'item-1', quantity: 2 },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException)
  })
})
