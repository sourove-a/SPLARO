import { ServerErrorAlertService, routeFingerprint } from './server-error-alert.service'

function buildService() {
  const hub = {
    notifyServerError: jest.fn().mockResolvedValue(undefined),
    notifyServerErrorsMuted: jest.fn().mockResolvedValue(undefined),
  }
  return { service: new ServerErrorAlertService(hub as never), hub }
}

/** report() is fire-and-forget, so let its promise chain settle. */
async function flush() {
  await new Promise((resolve) => setImmediate(resolve))
}

function boom(overrides: Partial<Parameters<ServerErrorAlertService['report']>[0]> = {}) {
  return {
    method: 'POST',
    url: '/api/v1/storefront/orders',
    statusCode: 500,
    message: 'Prisma connection refused',
    stack: 'Error: boom\n    at handler (/app/src/modules/orders/orders.controller.ts:12:3)',
    ...overrides,
  }
}

describe('routeFingerprint', () => {
  it('collapses cuid, uuid and numeric ids', () => {
    expect(routeFingerprint('/orders/clx0123456789abcdefghijk/items')).toBe('/orders/:id/items')
    expect(routeFingerprint('/orders/8f1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d')).toBe('/orders/:id')
    expect(routeFingerprint('/products/4821')).toBe('/products/:id')
    expect(routeFingerprint('/orders/SPL-10023/invoice')).toBe('/orders/:id/invoice')
  })

  it('drops the query string but keeps real path segments', () => {
    expect(routeFingerprint('/storefront/products?storeId=abc&page=2')).toBe(
      '/storefront/products',
    )
  })
})

describe('ServerErrorAlertService', () => {
  let now = 1_700_000_000_000

  beforeEach(() => {
    now = 1_700_000_000_000
    jest.spyOn(Date, 'now').mockImplementation(() => now)
    delete process.env['SERVER_ERROR_ALERTS']
    delete process.env['SERVER_ERROR_ALERT_MAX_PER_HOUR']
    delete process.env['SERVER_ERROR_ALERT_WINDOW_MINUTES']
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('alerts on the first failure, with the frames from our own code', async () => {
    const { service, hub } = buildService()
    service.report(boom())
    await flush()

    expect(hub.notifyServerError).toHaveBeenCalledTimes(1)
    expect(hub.notifyServerError.mock.calls[0][0]).toMatchObject({
      method: 'POST',
      route: '/api/v1/storefront/orders',
      statusCode: 500,
      repeats: 0,
    })
    expect(hub.notifyServerError.mock.calls[0][0].frames[0]).toContain('orders.controller.ts')
  })

  it('stays quiet for the same failure inside the window', async () => {
    const { service, hub } = buildService()
    for (let i = 0; i < 5; i++) {
      service.report(boom())
      await flush()
      now += 60_000
    }
    expect(hub.notifyServerError).toHaveBeenCalledTimes(1)
  })

  it('treats the same route with different ids as one failure', async () => {
    const { service, hub } = buildService()
    service.report(boom({ url: '/orders/clx0123456789abcdefghijk' }))
    await flush()
    service.report(boom({ url: '/orders/clx9999999999zzzzzzzzzzz' }))
    await flush()

    expect(hub.notifyServerError).toHaveBeenCalledTimes(1)
  })

  it('alerts separately for a different route', async () => {
    const { service, hub } = buildService()
    service.report(boom())
    await flush()
    service.report(boom({ url: '/api/v1/admin/products' }))
    await flush()

    expect(hub.notifyServerError).toHaveBeenCalledTimes(2)
  })

  it('re-alerts after the window, reporting how many it swallowed', async () => {
    const { service, hub } = buildService()
    service.report(boom())
    await flush()
    for (let i = 0; i < 3; i++) {
      service.report(boom())
      await flush()
    }

    now += 16 * 60_000
    service.report(boom())
    await flush()

    expect(hub.notifyServerError).toHaveBeenCalledTimes(2)
    expect(hub.notifyServerError.mock.calls[1][0]).toMatchObject({ repeats: 3 })
  })

  it('stops at the hourly ceiling and says so once', async () => {
    process.env['SERVER_ERROR_ALERT_MAX_PER_HOUR'] = '2'
    const { service, hub } = buildService()

    for (let i = 0; i < 5; i++) {
      service.report(boom({ url: `/api/v1/route-${i}` }))
      await flush()
    }

    expect(hub.notifyServerError).toHaveBeenCalledTimes(2)
    expect(hub.notifyServerErrorsMuted).toHaveBeenCalledTimes(1)
  })

  it('lets alerts through again once the hour has rolled', async () => {
    process.env['SERVER_ERROR_ALERT_MAX_PER_HOUR'] = '1'
    const { service, hub } = buildService()

    service.report(boom({ url: '/api/v1/a' }))
    await flush()
    service.report(boom({ url: '/api/v1/b' }))
    await flush()
    expect(hub.notifyServerError).toHaveBeenCalledTimes(1)

    now += 61 * 60_000
    service.report(boom({ url: '/api/v1/c' }))
    await flush()
    expect(hub.notifyServerError).toHaveBeenCalledTimes(2)
  })

  it('sends nothing when alerts are switched off', async () => {
    process.env['SERVER_ERROR_ALERTS'] = 'false'
    const { service, hub } = buildService()
    service.report(boom())
    await flush()

    expect(hub.notifyServerError).not.toHaveBeenCalled()
  })

  it('swallows a failing Telegram hub rather than replacing the real error', async () => {
    const { service, hub } = buildService()
    hub.notifyServerError.mockRejectedValue(new Error('telegram down'))

    expect(() => service.report(boom())).not.toThrow()
    await flush()
  })

  it('works with no hub wired at all', async () => {
    const service = new ServerErrorAlertService()
    expect(() => service.report(boom())).not.toThrow()
    await flush()
  })
})
