import { BadRequestException } from '@nestjs/common'
import { PlatformService } from './platform.service'

type TimedRow = { id: string; createdAt?: Date; updatedAt?: Date }

function pageRows<T extends TimedRow>(rows: T[], args: { where?: { AND?: Array<{ OR?: Array<Record<string, unknown>> }> } }, field: 'createdAt' | 'updatedAt') {
  const boundary = args.where?.AND?.find((item) => item.OR?.some((clause) => field in clause))?.OR
  if (!boundary) return rows
  const lt = boundary.find((clause) => {
    const value = clause[field]
    return typeof value === 'object' && value !== null && 'lt' in value
  })?.[field] as { lt?: Date } | undefined
  const equal = boundary.find((clause) => clause.id)?.[field] as Date | undefined
  const idLt = boundary.find((clause) => clause.id)?.id as { lt?: string } | undefined
  return rows.filter((row) => {
    const date = row[field]
    if (!date) return false
    if (lt?.lt && date < lt.lt) return true
    return Boolean(equal && idLt?.lt && date.getTime() === equal.getTime() && row.id < idLt.lt)
  })
}

function buildService() {
  const mediaRows = [{
    id: 'media-4', storeId: 'store-1', name: 'Newest', path: '/uploads/media/new.webp',
    altText: 'Newest', folder: 'media', mimeType: 'image/webp', sizeBytes: 10,
    width: 100, height: 100, createdAt: new Date('2026-08-04T00:00:00Z'), updatedAt: new Date('2026-08-04T00:00:00Z'),
  }]
  const productRows = [{
    id: 'product-3', productId: 'p-1', url: '/uploads/products/p.w1200.webp', altText: 'Product',
    createdAt: new Date('2026-08-03T00:00:00Z'), product: { name: 'Product', slug: 'product' },
  }]
  const bannerRows = [{
    id: 'banner-2', title: 'Hero', image: '/uploads/media/hero.webp', position: 'hero',
    updatedAt: new Date('2026-08-02T00:00:00Z'),
  }]
  const categoryRows = [{
    id: 'category-1', name: 'Men', image: '/uploads/media/men.webp', slug: 'men',
    updatedAt: new Date('2026-08-01T00:00:00Z'),
  }]
  const prisma = {
    store: { findFirst: jest.fn().mockResolvedValue({ id: 'store-1' }) },
    mediaAsset: {
      findMany: jest.fn((args) => Promise.resolve(pageRows(mediaRows, args, 'updatedAt'))),
      count: jest.fn().mockResolvedValue(1),
    },
    productImage: {
      findMany: jest.fn((args) => Promise.resolve(pageRows(productRows, args, 'createdAt'))),
      count: jest.fn().mockResolvedValue(1),
    },
    banner: {
      findMany: jest.fn((args) => Promise.resolve(pageRows(bannerRows, args, 'updatedAt'))),
      count: jest.fn().mockResolvedValue(1),
    },
    category: {
      findMany: jest.fn((args) => Promise.resolve(pageRows(categoryRows, args, 'updatedAt'))),
      count: jest.fn().mockResolvedValue(1),
    },
  }
  return new PlatformService(prisma as never)
}

describe('PlatformService media pagination', () => {
  it('returns stable cursor pages without duplicate assets', async () => {
    const service = buildService()
    const first = await service.getMedia('splaro', { limit: 2 })
    const cursor = first.pageInfo.nextCursor
    if (!cursor) throw new Error('Expected next media cursor')
    const second = await service.getMedia('splaro', { limit: 2, cursor })

    expect(first.assets.map((asset) => asset.id)).toEqual(['media-4', 'product-3'])
    expect(second.assets.map((asset) => asset.id)).toEqual(['banner-2', 'category-1'])
    expect(first.pageInfo.hasMore).toBe(true)
    expect(second.pageInfo.hasMore).toBe(false)
    expect(first.assets[0]?.publicUrl).toMatch(/^https?:\/\//)
    expect(first.stats).toEqual(expect.objectContaining({ total: 4, missingAlt: 3 }))
  })

  it('rejects invalid cursors and limits', async () => {
    const service = buildService()

    await expect(service.getMedia('splaro', { cursor: 'not-a-cursor' })).rejects.toBeInstanceOf(BadRequestException)
    await expect(service.getMedia('splaro', { limit: Number.NaN })).rejects.toBeInstanceOf(BadRequestException)
  })
})
