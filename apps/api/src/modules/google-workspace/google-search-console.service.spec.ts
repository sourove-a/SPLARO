import { BadRequestException, HttpException } from '@nestjs/common'

const sitesList = jest.fn()
const inspect = jest.fn()
const getAuthenticatedClient = jest.fn()
const resolveStoreId = jest.fn()

jest.mock('../../common/store.util', () => ({
  resolveStoreId: (...args: unknown[]) => resolveStoreId(...args),
}))

jest.mock('googleapis', () => ({
  google: {
    searchconsole: () => ({
      sites: { list: (...args: unknown[]) => sitesList(...args) },
      searchanalytics: { query: jest.fn().mockResolvedValue({ data: { rows: [] } }) },
      sitemaps: { list: jest.fn().mockResolvedValue({ data: { sitemap: [] } }) },
      urlInspection: { index: { inspect: (...args: unknown[]) => inspect(...args) } },
    }),
  },
}))

import { GoogleSearchConsoleService } from './google-search-console.service'

describe('GoogleSearchConsoleService', () => {
  const prisma = {
    googleWorkspaceConnection: { findUnique: jest.fn() },
    googleWorkspaceToken: { findUnique: jest.fn() },
    product: { findMany: jest.fn() },
  }
  const cache = {
    storeKey: (storeId: string, resource: string, suffix = '') =>
      `splaro:${storeId}:${resource}${suffix ? `:${suffix}` : ''}`,
    getOrSet: jest.fn(async (_key: string, _ttl: number, loader: () => Promise<unknown>) => loader()),
    invalidateStoreResource: jest.fn(),
  }
  const redis = { incrWithExpiry: jest.fn() }
  const config = { get: jest.fn() }

  let service: GoogleSearchConsoleService

  beforeEach(() => {
    jest.clearAllMocks()
    resolveStoreId.mockResolvedValue('store-1')
    prisma.googleWorkspaceConnection.findUnique.mockResolvedValue({
      id: 'conn-1',
      storeId: 'store-1',
      googleEmail: 'splaro.bd@gmail.com',
      scopes: 'https://www.googleapis.com/auth/webmasters.readonly',
    })
    prisma.googleWorkspaceToken.findUnique.mockResolvedValue({
      refreshTokenEncrypted: 'enc:token',
      scope: 'https://www.googleapis.com/auth/webmasters.readonly',
    })
    getAuthenticatedClient.mockResolvedValue({})
    cache.getOrSet.mockImplementation(async (_key, _ttl, loader) => loader())
    redis.incrWithExpiry.mockResolvedValue(1)
    config.get.mockReturnValue(undefined)
    sitesList.mockResolvedValue({
      data: { siteEntry: [{ siteUrl: 'sc-domain:splaro.co', permissionLevel: 'siteOwner' }] },
    })
    inspect.mockResolvedValue({
      data: { inspectionResult: { indexStatusResult: { coverageState: 'Submitted and indexed' } } },
    })

    service = new GoogleSearchConsoleService(
      prisma as never,
      { getAuthenticatedClient } as never,
      cache as never,
      redis as never,
      config as never,
    )
  })

  it('reports not_connected when OAuth refresh token is missing', async () => {
    prisma.googleWorkspaceToken.findUnique.mockResolvedValue(null)
    const status = await service.getStatus('splaro')
    expect(status.connected).toBe(false)
    expect(status.status).toBe('not_connected')
    expect(sitesList).not.toHaveBeenCalled()
  })

  it('asks for reconnect when webmasters.readonly is missing from the stored scope', async () => {
    prisma.googleWorkspaceToken.findUnique.mockResolvedValue({
      refreshTokenEncrypted: 'enc:token',
      scope: 'https://www.googleapis.com/auth/spreadsheets',
    })
    prisma.googleWorkspaceConnection.findUnique.mockResolvedValue({
      id: 'conn-1',
      storeId: 'store-1',
      googleEmail: 'splaro.bd@gmail.com',
      scopes: 'https://www.googleapis.com/auth/spreadsheets',
    })
    const status = await service.getStatus('splaro')
    expect(status.status).toBe('needs_reconnect')
    expect(status.needsReconnect).toBe(true)
  })

  it('connects when sites.list returns a splaro.co property', async () => {
    const status = await service.getStatus('splaro')
    expect(status.connected).toBe(true)
    expect(status.property).toBe('sc-domain:splaro.co')
    expect(status.permission).toBe('owner')
  })

  it('rejects inspect URLs outside splaro.co', async () => {
    await expect(service.inspectUrl('splaro', 'https://example.com/page')).rejects.toBeInstanceOf(BadRequestException)
    expect(inspect).not.toHaveBeenCalled()
  })

  it('throttles URL inspection after the hourly cap', async () => {
    redis.incrWithExpiry.mockResolvedValue(21)
    await expect(service.inspectUrl('splaro', 'https://splaro.co/products/x')).rejects.toBeInstanceOf(HttpException)
    expect(inspect).not.toHaveBeenCalled()
  })

  it('uses CacheService store keys under gsc', async () => {
    await service.getStatus('splaro')
    expect(cache.getOrSet).toHaveBeenCalledWith('splaro:store-1:gsc:status', 15 * 60, expect.any(Function))
  })
})
