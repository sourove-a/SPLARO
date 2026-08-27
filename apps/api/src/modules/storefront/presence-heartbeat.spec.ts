import { BadRequestException } from '@nestjs/common'
import { StorefrontController } from './storefront.controller'

function buildController(sessionUser: { customerId?: string } | null) {
  const presence = { heartbeat: jest.fn().mockResolvedValue(undefined) }
  const storefrontAuth = { validateSession: jest.fn().mockResolvedValue(sessionUser) }
  const prisma = { store: { findFirst: jest.fn().mockResolvedValue({ id: 'store-1' }) } }

  const controller = Object.create(StorefrontController.prototype) as StorefrontController
  Object.assign(controller, { presence, prisma, storefrontAuth })
  return { controller, presence, storefrontAuth }
}

jest.mock('../../common/store.util', () => ({
  resolveStoreId: jest.fn(async (_p: unknown, raw?: string) => raw ?? 'store-1'),
}))

describe('storefront presence heartbeat', () => {
  it('records the anonymous visitor for a signed-out shopper', async () => {
    const { controller, presence } = buildController(null)

    await controller.presenceHeartbeat('store-1', { visitorId: 'visitor-abc' })

    expect(presence.heartbeat).toHaveBeenCalledTimes(1)
    expect(presence.heartbeat).toHaveBeenCalledWith('store-1', 'visitor-abc', 'storefront')
  })

  it('adds the customer member when a valid session is presented', async () => {
    const { controller, presence } = buildController({ customerId: 'cus_1' })

    await controller.presenceHeartbeat('store-1', { visitorId: 'visitor-abc' }, undefined, 'tok')

    expect(presence.heartbeat).toHaveBeenCalledWith('store-1', 'visitor-abc', 'storefront')
    expect(presence.heartbeat).toHaveBeenCalledWith('store-1', 'customer:cus_1', 'storefront')
  })

  it('takes the identity from the session, never from the request body', async () => {
    const { controller, presence } = buildController({ customerId: 'cus_mine' })

    await controller.presenceHeartbeat(
      'store-1',
      // A caller trying to paint somebody else green.
      { visitorId: 'visitor-abc', customerId: 'cus_someone_else' } as never,
      undefined,
      'tok',
    )

    const members = presence.heartbeat.mock.calls.map((c) => c[1])
    expect(members).toContain('customer:cus_mine')
    expect(members).not.toContain('customer:cus_someone_else')
  })

  it('ignores a session token that does not validate', async () => {
    const { controller, presence } = buildController(null)

    await controller.presenceHeartbeat('store-1', { visitorId: 'visitor-abc' }, undefined, 'forged')

    expect(presence.heartbeat).toHaveBeenCalledTimes(1)
  })

  it('stays anonymous for a signed-in user with no customer row yet', async () => {
    const { controller, presence } = buildController({})

    await controller.presenceHeartbeat('store-1', { visitorId: 'visitor-abc' }, undefined, 'tok')

    expect(presence.heartbeat).toHaveBeenCalledTimes(1)
  })

  it('still requires a visitor id', async () => {
    const { controller } = buildController(null)

    await expect(controller.presenceHeartbeat('store-1', {})).rejects.toBeInstanceOf(
      BadRequestException,
    )
  })
})
