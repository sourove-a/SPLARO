import { BadRequestException, NotFoundException } from '@nestjs/common'
import { WholesaleService } from './wholesale.service'
import { revalidateStorefrontWeb } from '../../common/revalidate-web'

jest.mock('../../common/revalidate-web', () => ({
  revalidateStorefrontWeb: jest.fn(),
}))

function buildService(opts: { recent?: unknown; existing?: unknown } = {}) {
  const prisma = {
    wholesaleInquiry: {
      // The duplicate probe filters on createdAt; every other lookup is "find this row".
      findFirst: jest.fn().mockImplementation(async (args: { where?: Record<string, unknown> }) =>
        args?.where && 'createdAt' in args.where ? (opts.recent ?? null) : (opts.existing ?? null),
      ),
      create: jest.fn().mockResolvedValue({ id: 'lead-1' }),
      update: jest.fn().mockImplementation(async ({ data }: { data: unknown }) => ({
        id: 'lead-1',
        ...(data as Record<string, unknown>),
      })),
      delete: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      groupBy: jest.fn().mockResolvedValue([{ status: 'NEW', _count: { _all: 2 } }]),
    },
    wholesaleStockImage: {
      findFirst: jest.fn().mockResolvedValue(opts.existing ?? null),
      create: jest.fn().mockResolvedValue({ id: 'stock-1', url: '/uploads/wholesale/look.webp' }),
      update: jest.fn().mockImplementation(async ({ data }: { data: unknown }) => ({
        id: 'stock-1',
        ...(data as Record<string, unknown>),
      })),
      delete: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([]),
    },
  }
  return { service: new WholesaleService(prisma as never), prisma }
}

const base = {
  fullName: 'Rahim Trading',
  industry: 'Distributor',
  country: 'Bangladesh',
  phone: '8801822334455',
}

describe('WholesaleService.submit', () => {
  it('stores a Bangladesh number in the same 01… form as the rest of the app', async () => {
    const { service, prisma } = buildService()

    await service.submit('store-1', base)

    expect(prisma.wholesaleInquiry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ phone: '01822334455', storeId: 'store-1' }),
      }),
    )
  })

  it('keeps a foreign number exactly as the buyer typed it', async () => {
    const { service, prisma } = buildService()

    await service.submit('store-1', { ...base, country: 'Sweden', phone: '+46 70 123 45 67' })

    expect(prisma.wholesaleInquiry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ phone: '+46 70 123 45 67' }),
      }),
    )
  })

  it('folds a repeat submit from the same number back onto the first lead', async () => {
    const { service, prisma } = buildService({
      recent: { id: 'lead-existing', createdAt: new Date() },
    })

    const result = await service.submit('store-1', base)

    expect(result).toEqual({ id: 'lead-existing', duplicate: true })
    expect(prisma.wholesaleInquiry.create).not.toHaveBeenCalled()
  })

  it('rejects a submission missing a required field', async () => {
    const { service } = buildService()

    await expect(
      service.submit('store-1', { ...base, industry: '   ' }),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('drops remote image URLs and keeps only same-origin wholesale uploads', async () => {
    const { service, prisma } = buildService()

    await service.submit('store-1', {
      ...base,
      imageUrls: [
        'https://evil.example/x.webp',
        '/uploads/wholesale/look.webp',
        '/uploads/other/no.webp',
      ],
    })

    const data = prisma.wholesaleInquiry.create.mock.calls[0]?.[0]?.data as Record<string, unknown>
    expect(data['imageUrls']).toEqual(['/uploads/wholesale/look.webp'])
  })

  it('drops blank optional fields instead of storing empty strings', async () => {
    const { service, prisma } = buildService()

    await service.submit('store-1', { ...base, companyName: '  ', message: '' })

    const data = prisma.wholesaleInquiry.create.mock.calls[0]?.[0]?.data as Record<string, unknown>
    expect(data).not.toHaveProperty('companyName')
    expect(data).not.toHaveProperty('message')
  })
})

describe('WholesaleService.update', () => {
  it('stamps who handled the lead when it moves out of NEW', async () => {
    const { service, prisma } = buildService({ existing: { id: 'lead-1', status: 'NEW' } })

    await service.update('store-1', 'lead-1', { status: 'CONTACTED', handledById: 'user-9' })

    const data = prisma.wholesaleInquiry.update.mock.calls[0]?.[0]?.data as Record<string, unknown>
    expect(data['status']).toBe('CONTACTED')
    expect(data['handledById']).toBe('user-9')
    expect(data['handledAt']).toBeInstanceOf(Date)
  })

  it('refuses an unknown status rather than writing it', async () => {
    const { service } = buildService({ existing: { id: 'lead-1', status: 'NEW' } })

    await expect(
      service.update('store-1', 'lead-1', { status: 'ARCHIVED' }),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('will not touch a lead belonging to another store', async () => {
    const { service } = buildService({ existing: null })

    await expect(
      service.update('store-1', 'lead-other', { status: 'WON' }),
    ).rejects.toBeInstanceOf(NotFoundException)
  })
})

describe('WholesaleService.stock', () => {
  beforeEach(() => {
    ;(revalidateStorefrontWeb as jest.Mock).mockClear()
  })

  it('rejects a stock URL that is not a wholesale or local image upload', async () => {
    const { service, prisma } = buildService()

    await expect(
      service.createStockImage('store-1', { url: 'https://cdn.example/look.webp' }),
    ).rejects.toBeInstanceOf(BadRequestException)
    expect(prisma.wholesaleStockImage.create).not.toHaveBeenCalled()
    expect(revalidateStorefrontWeb).not.toHaveBeenCalled()
  })

  it('revalidates the storefront gallery after a stock write', async () => {
    const { service } = buildService({ existing: { id: 'stock-1' } })

    await service.createStockImage('store-1', { url: '/uploads/wholesale/look.webp' })
    expect(revalidateStorefrontWeb).toHaveBeenCalledWith(['wholesale-stock'])

    ;(revalidateStorefrontWeb as jest.Mock).mockClear()
    await service.updateStockImage('store-1', 'stock-1', { title: 'Look 01' })
    expect(revalidateStorefrontWeb).toHaveBeenCalledWith(['wholesale-stock'])

    ;(revalidateStorefrontWeb as jest.Mock).mockClear()
    await service.removeStockImage('store-1', 'stock-1')
    expect(revalidateStorefrontWeb).toHaveBeenCalledWith(['wholesale-stock'])
  })
})

describe('WholesaleService.list', () => {
  it('reports a count for every status, including the empty ones', async () => {
    const { service } = buildService()

    const result = await service.list('store-1')

    expect(result.counts).toEqual({ NEW: 2, CONTACTED: 0, QUALIFIED: 0, WON: 0, LOST: 0 })
  })

  it('caps the page size so one request cannot pull the whole table', async () => {
    const { service, prisma } = buildService()

    await service.list('store-1', { limit: 5000 })

    expect(prisma.wholesaleInquiry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 }),
    )
  })
})
