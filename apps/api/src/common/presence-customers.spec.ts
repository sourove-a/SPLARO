import { PresenceService, presenceCustomerMember } from './presence.service'

jest.mock('./store.util', () => ({
  resolveStoreId: jest.fn(async (_p: unknown, raw?: string) => raw ?? 'store-1'),
}))

function buildService(opts: {
  ready?: boolean
  members?: string[]
  sessionCustomers?: { id: string }[]
} = {}) {
  const redis = {
    isReady: opts.ready ?? true,
    listPresenceMembers: jest.fn().mockResolvedValue(opts.members ?? []),
    countPresenceSet: jest.fn().mockResolvedValue(0),
    touchPresenceSet: jest.fn().mockResolvedValue(undefined),
  }
  const prisma = {
    customer: { findMany: jest.fn().mockResolvedValue(opts.sessionCustomers ?? []) },
    deviceSession: { count: jest.fn().mockResolvedValue(0) },
    user: { findMany: jest.fn().mockResolvedValue([]) },
  }
  return { service: new PresenceService(redis as never, prisma as never), redis, prisma }
}

describe('presenceCustomerMember', () => {
  it('namespaces a customer so anonymous visitor ids can never be read back as one', () => {
    expect(presenceCustomerMember('cus_1')).toBe('customer:cus_1')
  })
})

describe('PresenceService.getOnlineCustomers — live', () => {
  it('returns only the customer-prefixed members', async () => {
    const { service } = buildService({
      members: ['customer:cus_1', 'a2f9-anonymous-uuid', 'customer:cus_2', 'admin:usr_9'],
    })

    const snap = await service.getOnlineCustomers('store-1')
    expect(snap.online.sort()).toEqual(['cus_1', 'cus_2'])
    expect(snap.source).toBe('live')
  })

  it('de-duplicates a shopper browsing in two tabs', async () => {
    const { service } = buildService({ members: ['customer:cus_1', 'customer:cus_1'] })
    expect((await service.getOnlineCustomers('store-1')).online).toEqual(['cus_1'])
  })

  it('never mistakes an admin member for a shopper', async () => {
    const { service } = buildService({ members: ['admin:usr_9'] })
    expect((await service.getOnlineCustomers('store-1')).online).toEqual([])
  })

  it('reads the storefront set, not the admin one', async () => {
    const { service, redis } = buildService({ members: [] })
    await service.getOnlineCustomers('store-1')
    expect(redis.listPresenceMembers).toHaveBeenCalledWith(
      'splaro:presence:store-1:storefront',
      expect.any(Number),
    )
  })
})

describe('PresenceService.getOnlineCustomers — Redis down', () => {
  it('falls back to recent device sessions rather than reporting everyone offline', async () => {
    const { service, prisma } = buildService({
      ready: false,
      sessionCustomers: [{ id: 'cus_7' }],
    })

    const snap = await service.getOnlineCustomers('store-1')
    expect(snap.online).toEqual(['cus_7'])
    expect(snap.source).toBe('sessions')
    // Scoped to the store, and only sessions that are live and unrevoked.
    const where = prisma.customer.findMany.mock.calls[0][0].where
    expect(where.storeId).toBe('store-1')
    const session = where.user.is.deviceSessions.some
    expect(session.isRevoked).toBe(false)
  })
})
