import { BadRequestException } from '@nestjs/common'
import type { PrismaService } from '../../common/prisma.service'
import { CustomersController } from './customers.controller'

jest.mock('../../common/order-cleanup', () => ({
  deleteOrderWithRelations: jest.fn().mockResolvedValue(true),
}))
jest.mock('../../common/store.util', () => ({
  resolveStoreId: jest.fn().mockResolvedValue('store-1'),
  slugify: (s: string) => s,
}))

interface SeedCustomer {
  id: string
  userId: string
  firstName: string
  lastName: string
  orders: number
}

/** Everything purgeCustomer touches, so a missed table shows up as a failure. */
const PURGED_TABLES = [
  'loyaltyHistory',
  'customerNote',
  'address',
  'wishlist',
  'cartSession',
  'review',
  'notification',
  'webPushToken',
  'referral',
] as const

function loginRow(
  userId: string,
  kind: 'shopper' | 'vendor' | 'staff' | 'owner',
) {
  if (kind === 'owner') {
    return {
      id: userId,
      email: 'splaro.bd@gmail.com',
      staffRoles: [{ id: 'sr-owner' }],
      ownedStores: [{ id: 'store-1' }],
      vendor: null,
    }
  }
  if (kind === 'staff') {
    return {
      id: userId,
      email: 'manager@example.com',
      staffRoles: [{ id: 'sr-1' }],
      ownedStores: [],
      vendor: null,
    }
  }
  if (kind === 'vendor') {
    return {
      id: userId,
      email: 'vendor@example.com',
      staffRoles: [],
      ownedStores: [],
      vendor: { id: 'v1' },
    }
  }
  return {
    id: userId,
    email: 'shopper@example.com',
    staffRoles: [],
    ownedStores: [],
    vendor: null,
  }
}

function buildController(
  customers: SeedCustomer[],
  opts: { vendorUser?: boolean; staffUser?: boolean; ownerUser?: boolean } = {},
) {
  const deleteMany = jest.fn().mockResolvedValue({ count: 0 })
  const tables = Object.fromEntries(PURGED_TABLES.map((t) => [t, { deleteMany }])) as Record<
    string,
    { deleteMany: jest.Mock }
  >

  const customerDelete = jest.fn().mockResolvedValue({})
  const userDelete = jest.fn().mockResolvedValue({})
  const userUpdate = jest.fn().mockResolvedValue({})
  const loginKind = opts.ownerUser ? 'owner' : opts.staffUser ? 'staff' : opts.vendorUser ? 'vendor' : 'shopper'

  const tx = {
    ...tables,
    order: {
      findMany: jest.fn(async ({ where }: { where: { customerId: string } }) => {
        const seeded = customers.find((c) => c.id === where.customerId)
        return Array.from({ length: seeded?.orders ?? 0 }, (_, i) => ({ id: `o-${i}` }))
      }),
    },
    rMA: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    auditLog: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    customer: { delete: customerDelete },
    user: {
      findFirst: jest.fn().mockImplementation(async ({ where }: { where: { id: string } }) =>
        loginRow(where.id, loginKind),
      ),
      delete: userDelete,
      update: userUpdate,
    },
  }

  const prisma = {
    customer: {
      findMany: jest.fn().mockResolvedValue(
        customers.map((c) => ({
          id: c.id,
          userId: c.userId,
          firstName: c.firstName,
          lastName: c.lastName,
          _count: { orders: c.orders },
        })),
      ),
    },
    $transaction: jest.fn(async (fn: (t: unknown) => Promise<unknown>) => fn(tx)),
  } as unknown as PrismaService

  const controller = new CustomersController(prisma, {} as never, {} as never, {} as never)
  return { controller, tx, customerDelete, userDelete, userUpdate, prisma }
}

const fake = (id: string, orders = 0): SeedCustomer => ({
  id,
  userId: `u-${id}`,
  firstName: 'Test',
  lastName: id,
  orders,
})

describe('CustomersController bulk delete', () => {
  it('rejects an empty selection', async () => {
    const { controller } = buildController([])
    await expect(controller.bulkRemove({ ids: [] })).rejects.toBeInstanceOf(BadRequestException)
  })

  it('caps the batch size', async () => {
    const { controller } = buildController([])
    const ids = Array.from({ length: 101 }, (_, i) => `c${i}`)
    await expect(controller.bulkRemove({ ids })).rejects.toThrow(/at most 100/i)
  })

  it('deletes throwaway accounts that carry no orders', async () => {
    const { controller, customerDelete } = buildController([fake('a'), fake('b')])

    const result = await controller.bulkRemove({ ids: ['a', 'b'] })
    expect(result).toMatchObject({ deleted: 2, ordersDeleted: 0, skipped: [] })
    expect(customerDelete).toHaveBeenCalledTimes(2)
  })

  it('keeps a customer holding orders unless force is set', async () => {
    const { controller, customerDelete } = buildController([fake('a'), fake('b', 4)])

    const result = await controller.bulkRemove({ ids: ['a', 'b'] })
    expect(result.deleted).toBe(1)
    expect(customerDelete).toHaveBeenCalledTimes(1)
    expect(result.skipped).toEqual([
      { id: 'b', name: 'Test b', reason: '4 orders on file' },
    ])
  })

  it('takes the orders down too when force is set', async () => {
    const { controller } = buildController([fake('b', 3)])

    const result = await controller.bulkRemove({ ids: ['b'], force: true })
    expect(result).toMatchObject({ deleted: 1, ordersDeleted: 3, skipped: [] })
  })

  it('counts orders from the relation, not the denormalised column', async () => {
    // Customer.totalOrders can lag; trusting it would send a customer with real
    // orders down the no-force path and into a raw foreign-key error.
    const { controller, prisma } = buildController([fake('a', 2)])
    await controller.bulkRemove({ ids: ['a'] })

    const select = (prisma as unknown as { customer: { findMany: jest.Mock } }).customer.findMany
      .mock.calls[0]![0].select
    expect(select._count).toEqual({ select: { orders: true } })
    expect(select.totalOrders).toBeUndefined()
  })

  it('clears every table that holds the customer by a restricting key', async () => {
    const { controller, tx } = buildController([fake('a')])
    await controller.bulkRemove({ ids: ['a'] })

    for (const table of PURGED_TABLES) {
      expect(tx[table]!.deleteMany).toHaveBeenCalled()
    }
    expect(tx.rMA.updateMany).toHaveBeenCalledWith({
      where: { customerId: 'a' },
      data: { customerId: null },
    })
  })

  it('detaches the audit trail instead of deleting it', async () => {
    const { controller, tx } = buildController([fake('a')])
    await controller.bulkRemove({ ids: ['a'] })

    expect(tx.auditLog.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u-a' },
      data: { userId: null },
    })
  })

  it('deactivates rather than deletes a vendor-only login', async () => {
    const { controller, userDelete, userUpdate } = buildController([fake('a')], {
      vendorUser: true,
    })
    await controller.bulkRemove({ ids: ['a'] })

    expect(userDelete).not.toHaveBeenCalled()
    expect(userUpdate).toHaveBeenCalledWith({ where: { id: 'u-a' }, data: { isActive: false } })
  })

  it('deletes the shopper row but never touches the primary owner User', async () => {
    const { controller, customerDelete, userDelete, userUpdate } = buildController([fake('a')], {
      ownerUser: true,
    })
    await controller.bulkRemove({ ids: ['a'] })

    expect(customerDelete).toHaveBeenCalled()
    expect(userDelete).not.toHaveBeenCalled()
    expect(userUpdate).not.toHaveBeenCalled()
  })

  it('deletes the shopper row but never deactivates invited staff', async () => {
    const { controller, customerDelete, userDelete, userUpdate } = buildController([fake('a')], {
      staffUser: true,
    })
    await controller.bulkRemove({ ids: ['a'] })

    expect(customerDelete).toHaveBeenCalled()
    expect(userDelete).not.toHaveBeenCalled()
    expect(userUpdate).not.toHaveBeenCalled()
  })

  it('reports an id that is not in this store rather than silently ignoring it', async () => {
    const { controller } = buildController([fake('a')])

    const result = await controller.bulkRemove({ ids: ['a', 'not-mine'] })
    expect(result.deleted).toBe(1)
    expect(result.skipped).toContainEqual({
      id: 'not-mine',
      name: 'not-mine',
      reason: 'Not found in this store',
    })
  })

  it('lets the sweep continue when one record fails', async () => {
    const { controller, prisma } = buildController([fake('a'), fake('b')])
    const tx = prisma.$transaction as unknown as jest.Mock
    tx.mockImplementationOnce(() => Promise.reject(new Error('deadlock detected')))

    const result = await controller.bulkRemove({ ids: ['a', 'b'] })
    expect(result.deleted).toBe(1)
    expect(result.skipped).toEqual([{ id: 'a', name: 'Test a', reason: 'deadlock detected' }])
  })

  it('deduplicates repeated ids', async () => {
    const { controller, prisma } = buildController([fake('a')])
    await controller.bulkRemove({ ids: ['a', 'a', 'a'] })

    const where = (prisma as unknown as { customer: { findMany: jest.Mock } }).customer.findMany.mock
      .calls[0]![0].where
    expect(where.id.in).toEqual(['a'])
  })
})
