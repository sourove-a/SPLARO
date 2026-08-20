import { BadRequestException } from '@nestjs/common'
import { CustomersService } from './customers.service'

function buildTx(opts: {
  existingCustomer?: { id: string; storeId: string; firstName: string; lastName: string; email: string | null; user: { role: string }; addresses: { id: string }[] } | null
  userByPhone?: { id: string; role: string; customer: { id: string; storeId: string; email: string | null } | null; staffRoles: { id: string }[] } | null
}) {
  const orderUpdateMany = jest.fn().mockResolvedValue({ count: 1 })
  const userCreate = jest.fn().mockResolvedValue({ id: 'user-guest' })
  const addressCreate = jest.fn().mockResolvedValue({ id: 'addr-1' })
  const customerCreate = jest.fn().mockResolvedValue({
    id: 'cust-new',
    firstName: 'Test',
    lastName: 'Customer',
    phone: '01711111111',
  })

  const tx = {
    customer: {
      findFirst: jest.fn().mockResolvedValue(opts.existingCustomer ?? null),
      findUniqueOrThrow: jest.fn().mockResolvedValue(opts.userByPhone?.customer ?? { id: 'cust-existing' }),
      findUnique: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({}),
      create: customerCreate,
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    user: {
      findFirst: jest.fn().mockResolvedValue(opts.userByPhone ?? null),
      create: userCreate,
    },
    order: {
      updateMany: orderUpdateMany,
      aggregate: jest.fn().mockResolvedValue({
        _count: 1,
        _sum: { total: 1200 },
        _min: { createdAt: new Date() },
        _max: { createdAt: new Date() },
      }),
    },
    address: { create: addressCreate },
    store: { findUnique: jest.fn().mockResolvedValue({ id: 'store-1' }) },
    $queryRaw: jest.fn().mockResolvedValue([{ max: 1 }]),
  }

  const prisma = {
    ...tx,
    $transaction: jest.fn(async (fn: (client: unknown) => Promise<unknown>) => fn(tx)),
  }

  return { service: new CustomersService(prisma as never), tx, orderUpdateMany, userCreate, customerCreate }
}

describe('CustomersService.ensureFromCheckout', () => {
  const input = {
    name: 'Test Customer',
    phone: '01711111111',
    email: 'test@example.com',
    address: 'House 1, Road 2',
    city: 'Dhaka',
    district: 'Dhaka',
    division: 'Dhaka',
  }

  it('links an existing phone match and attaches orphan orders', async () => {
    const { service, orderUpdateMany, userCreate } = buildTx({
      existingCustomer: {
        id: 'cust-1',
        storeId: 'store-1',
        firstName: 'Test',
        lastName: 'Customer',
        email: 'test@example.com',
        user: { role: 'CUSTOMER' },
        addresses: [{ id: 'a1' }],
      },
    })

    const row = await service.ensureFromCheckout('store-1', input)
    expect(row.id).toBe('cust-1')
    expect(orderUpdateMany).toHaveBeenCalled()
    expect(userCreate).not.toHaveBeenCalled()
  })

  it('creates a guest user + customer when the phone is new', async () => {
    const { service, userCreate, customerCreate } = buildTx({})
    const row = await service.ensureFromCheckout('store-1', input)
    expect(userCreate).toHaveBeenCalled()
    expect(customerCreate).toHaveBeenCalled()
    expect(row.id).toBe('cust-new')
  })

  it('rejects an invalid phone instead of inventing a CRM row', async () => {
    const { service } = buildTx({})
    await expect(service.ensureFromCheckout('store-1', { ...input, phone: '123' })).rejects.toBeInstanceOf(
      BadRequestException,
    )
  })
})
