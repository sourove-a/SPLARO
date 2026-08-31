import { BadRequestException } from '@nestjs/common'
import type { PrismaService } from '../../common/prisma.service'
import { OrdersController } from './orders.controller'
import { deleteOrderWithRelations } from '../../common/order-cleanup'

jest.mock('../../common/order-cleanup', () => ({
  deleteOrderWithRelations: jest.fn().mockResolvedValue(true),
}))
jest.mock('../../common/store.util', () => ({
  resolveStoreId: jest.fn().mockResolvedValue('store-1'),
}))

const purgeMock = deleteOrderWithRelations as jest.MockedFunction<typeof deleteOrderWithRelations>

type SeedOrder = {
  id: string
  invoiceNumber: string
  status: string
  storeId?: string
}

function order(seed: SeedOrder) {
  return {
    id: seed.id,
    storeId: seed.storeId ?? 'store-1',
    status: seed.status,
    invoiceNumber: seed.invoiceNumber,
    total: 1200,
    shippingName: 'Fake Buyer',
    shippingPhone: '01700000000',
    paymentMethod: 'CASH_ON_DELIVERY',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  }
}

function buildController(seeded: SeedOrder[]) {
  const rows = seeded.map(order)
  const auditCreate = jest.fn().mockResolvedValue({ id: 'audit-1' })
  const tx = { auditLog: { create: auditCreate } }
  const prisma = {
    order: {
      // Mirrors the real filter: ids in the requested set, scoped to the store.
      findMany: jest.fn(({ where }: { where: { id: { in: string[] }; storeId?: string } }) =>
        Promise.resolve(
          rows.filter(
            (row) =>
              where.id.in.includes(row.id) && (!where.storeId || row.storeId === where.storeId),
          ),
        ),
      ),
    },
    $transaction: jest.fn((fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
  } as unknown as PrismaService

  const controller = new OrdersController(
    prisma,
    {} as never, {} as never, {} as never, {} as never,
    {} as never, {} as never, {} as never, {} as never, {} as never,
  )
  return { controller, prisma, auditCreate }
}

const req = {
  adminUser: { userId: 'user-1', email: 'a@b.c', name: 'A', role: 'ADMIN', storeId: 'store-1', exp: 0 },
  ip: '10.0.0.1',
  socket: { remoteAddress: '10.0.0.1' },
  headers: { 'user-agent': 'jest' },
} as never

beforeEach(() => {
  purgeMock.mockClear()
  purgeMock.mockResolvedValue(true)
})

describe('OrdersController.purge', () => {
  it('deletes a cancelled order and records who did it', async () => {
    const { controller, auditCreate } = buildController([
      { id: 'o1', invoiceNumber: 'INV-1', status: 'CANCELLED' },
    ])

    const res = await controller.purge({ orderIds: ['o1'] }, req)

    expect(res.success).toBe(true)
    expect(res.deleted).toEqual([{ id: 'o1', invoiceNumber: 'INV-1' }])
    expect(res.skipped).toEqual([])
    expect(purgeMock).toHaveBeenCalledWith(expect.anything(), 'o1')

    // The order row is gone, so this entry is the only remaining evidence.
    expect(auditCreate).toHaveBeenCalledTimes(1)
    const audit = auditCreate.mock.calls[0][0].data
    expect(audit).toMatchObject({ action: 'delete', module: 'orders', resourceId: 'o1', userId: 'user-1' })
    expect(audit.oldData).toMatchObject({ invoiceNumber: 'INV-1', status: 'CANCELLED' })
  })

  it('refuses every status but CANCELLED', async () => {
    for (const status of ['PENDING', 'CONFIRMED', 'PROCESSING', 'PACKED', 'SHIPPED', 'DELIVERED', 'RETURNED']) {
      const { controller } = buildController([{ id: 'o1', invoiceNumber: 'INV-1', status }])
      const res = await controller.purge({ orderIds: ['o1'] }, req)

      expect(purgeMock).not.toHaveBeenCalled()
      expect(res.success).toBe(false)
      expect(res.deleted).toEqual([])
      expect(res.skipped[0]?.reason).toMatch(/Cancel INV-1 first/)
    }
  })

  it('deletes what it can and reports the rest, rather than failing the batch', async () => {
    const { controller } = buildController([
      { id: 'o1', invoiceNumber: 'INV-1', status: 'CANCELLED' },
      { id: 'o2', invoiceNumber: 'INV-2', status: 'SHIPPED' },
      { id: 'o3', invoiceNumber: 'INV-3', status: 'CANCELLED' },
    ])

    const res = await controller.purge({ orderIds: ['o1', 'o2', 'o3', 'ghost'] }, req)

    expect(res.deleted.map((d) => d.id)).toEqual(['o1', 'o3'])
    expect(res.skipped.map((s) => s.id).sort()).toEqual(['ghost', 'o2'])
    expect(res.skipped.find((s) => s.id === 'ghost')?.reason).toBe('Order not found')
  })

  it('cannot reach another store, and says only that it was not found', async () => {
    const { controller } = buildController([
      { id: 'o1', invoiceNumber: 'INV-1', status: 'CANCELLED', storeId: 'store-2' },
    ])

    const res = await controller.purge({ orderIds: ['o1'] }, req)

    expect(purgeMock).not.toHaveBeenCalled()
    expect(res.deleted).toEqual([])
    // Naming the real reason would confirm the id exists in another store.
    expect(res.skipped[0]?.reason).toBe('Order not found')
  })

  it('one failure does not take the rest of the batch down', async () => {
    const { controller } = buildController([
      { id: 'o1', invoiceNumber: 'INV-1', status: 'CANCELLED' },
      { id: 'o2', invoiceNumber: 'INV-2', status: 'CANCELLED' },
    ])
    purgeMock.mockRejectedValueOnce(new Error('FK constraint'))

    const res = await controller.purge({ orderIds: ['o1', 'o2'] }, req)

    expect(res.deleted.map((d) => d.id)).toEqual(['o2'])
    expect(res.skipped[0]).toMatchObject({ id: 'o1', reason: 'FK constraint' })
  })

  it('collapses duplicate ids so one order is never deleted twice', async () => {
    const { controller } = buildController([
      { id: 'o1', invoiceNumber: 'INV-1', status: 'CANCELLED' },
    ])

    const res = await controller.purge({ orderIds: ['o1', 'o1', ' o1 '] }, req)

    expect(purgeMock).toHaveBeenCalledTimes(1)
    expect(res.deleted).toHaveLength(1)
  })

  it('rejects a request with nothing usable in it', async () => {
    const { controller } = buildController([])
    await expect(controller.purge({ orderIds: ['   '] }, req)).rejects.toBeInstanceOf(
      BadRequestException,
    )
  })

  it('omits the bootstrap admin from the audit row it cannot point at', async () => {
    const { controller, auditCreate } = buildController([
      { id: 'o1', invoiceNumber: 'INV-1', status: 'CANCELLED' },
    ])
    const envAdmin = { ...(req as never as { adminUser: Record<string, unknown> }) } as never as typeof req
    ;(envAdmin as unknown as { adminUser: Record<string, unknown> }).adminUser = {
      userId: 'admin_env_user',
      storeId: 'store-1',
    }

    await controller.purge({ orderIds: ['o1'] }, envAdmin)

    expect(auditCreate.mock.calls[0][0].data.userId).toBeUndefined()
  })
})
