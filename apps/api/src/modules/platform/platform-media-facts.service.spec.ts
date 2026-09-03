import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { PlatformService } from './platform.service'

/**
 * A product photo is listed from its owner record, which stores a URL and
 * nothing else — so the media library showed an em dash where a library asset
 * showed its size. These cover both ways that gap is closed.
 */

type PrismaStub = Record<string, unknown>

function buildService(options: {
  libraryAssetForProduct?: boolean
  productUrl: string
}) {
  const productRow = {
    id: 'product-image-1',
    productId: 'p-1',
    url: options.productUrl,
    altText: 'Sneaker',
    createdAt: new Date('2026-08-03T00:00:00Z'),
    product: { name: 'LV Trainer', slug: 'lv-trainer' },
  }

  const matchingAsset = {
    path: options.productUrl,
    folder: 'footwear',
    mimeType: 'image/webp',
    sizeBytes: 44_000,
    width: 1200,
    height: 1600,
    contentHash: 'abc123',
    kind: 'image',
  }

  const prisma: PrismaStub = {
    store: { findFirst: jest.fn().mockResolvedValue({ id: 'store-1' }) },
    mediaAsset: {
      findMany: jest.fn((args: { where?: { path?: { in?: string[] } } }) => {
        // The enrichment pass is the only caller that filters by path.
        if (args?.where?.path?.in) {
          return Promise.resolve(options.libraryAssetForProduct ? [matchingAsset] : [])
        }
        return Promise.resolve([])
      }),
      count: jest.fn().mockResolvedValue(0),
    },
    productImage: {
      findMany: jest.fn().mockResolvedValue([productRow]),
      count: jest.fn().mockResolvedValue(1),
    },
    banner: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
    category: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
  }

  return new PlatformService(prisma as never)
}

describe('PlatformService media file facts', () => {
  const previousRoot = process.env.UPLOAD_DIR
  let root: string

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'splaro-media-facts-'))
    process.env.UPLOAD_DIR = root
  })

  afterEach(() => {
    if (previousRoot === undefined) delete process.env.UPLOAD_DIR
    else process.env.UPLOAD_DIR = previousRoot
    rmSync(root, { recursive: true, force: true })
  })

  it('takes size and dimensions from a library asset pointing at the same file', async () => {
    const service = buildService({
      libraryAssetForProduct: true,
      productUrl: '/uploads/footwear/lv.w1200.webp',
    })

    const result = await service.getMedia('splaro', { limit: 10 })
    const product = result.assets.find((asset) => asset.type === 'product') as
      | { sizeBytes?: number | null; width?: number | null; mimeType?: string | null }
      | undefined

    expect(product?.sizeBytes).toBe(44_000)
    expect(product?.width).toBe(1200)
    expect(product?.mimeType).toBe('image/webp')
  })

  it('falls back to the file on disk when nothing in the library points at it', async () => {
    mkdirSync(join(root, 'footwear'), { recursive: true })
    writeFileSync(join(root, 'footwear', 'orphan.webp'), Buffer.alloc(2048, 7))

    const service = buildService({
      libraryAssetForProduct: false,
      productUrl: '/uploads/footwear/orphan.webp',
    })

    const result = await service.getMedia('splaro', { limit: 10 })
    const product = result.assets.find((asset) => asset.type === 'product') as
      | { sizeBytes?: number | null; mimeType?: string | null }
      | undefined

    expect(product?.sizeBytes).toBe(2048)
    expect(product?.mimeType).toBe('image/webp')
  })

  it('leaves the row alone when the file is missing from disk', async () => {
    const service = buildService({
      libraryAssetForProduct: false,
      productUrl: '/uploads/footwear/deleted.webp',
    })

    const result = await service.getMedia('splaro', { limit: 10 })
    const product = result.assets.find((asset) => asset.type === 'product') as
      | { sizeBytes?: number | null }
      | undefined

    expect(product).toBeDefined()
    expect(product?.sizeBytes).toBeUndefined()
  })
})
