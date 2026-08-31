import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common'
import { access, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { MediaService } from './media.service'

function buildService(asset: Record<string, unknown> | null = null) {
  const prisma = {
    store: {
      findFirst: jest.fn().mockResolvedValue({ id: 'store-1' }),
      findUnique: jest.fn().mockResolvedValue(null),
    },
    mediaAsset: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(asset),
      upsert: jest.fn().mockImplementation(async ({ create }: { create: Record<string, unknown> }) => ({
        id: 'media-1',
        ...create,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      update: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'media-1',
        storeId: 'store-1',
        path: '/uploads/media/eid.webp',
        ...asset,
        ...data,
      })),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      delete: jest.fn().mockResolvedValue({ id: 'media-1' }),
      groupBy: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      aggregate: jest.fn().mockResolvedValue({ _sum: { sizeBytes: 0 }, _count: { _all: 0 } }),
    },
    mediaFolder: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
      upsert: jest.fn(),
      update: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    productImage: { findMany: jest.fn().mockResolvedValue([]) },
    productVariant: { findMany: jest.fn().mockResolvedValue([]) },
    banner: { findMany: jest.fn().mockResolvedValue([]) },
    category: { findMany: jest.fn().mockResolvedValue([]) },
    collection: { findMany: jest.fn().mockResolvedValue([]) },
    orderItem: { findMany: jest.fn().mockResolvedValue([]) },
    brand: { findMany: jest.fn().mockResolvedValue([]) },
    blogPost: { findMany: jest.fn().mockResolvedValue([]) },
    seoConfig: { findMany: jest.fn().mockResolvedValue([]) },
    wholesaleStockImage: { findMany: jest.fn().mockResolvedValue([]) },
    partner: { findMany: jest.fn().mockResolvedValue([]) },
    staffRole: { findMany: jest.fn().mockResolvedValue([]) },
    contentBlock: { findMany: jest.fn().mockResolvedValue([]) },
    sitePage: { findMany: jest.fn().mockResolvedValue([]) },
    siteSettings: { findUnique: jest.fn().mockResolvedValue(null) },
    menuItem: { findMany: jest.fn().mockResolvedValue([]) },
    $transaction: jest.fn().mockImplementation(async (ops: unknown) => {
      if (Array.isArray(ops)) return Promise.all(ops)
      return ops
    }),
  }
  return { service: new MediaService(prisma as never), prisma }
}

describe('MediaService', () => {
  it('stores SPLARO public links as portable upload paths', async () => {
    const { service, prisma } = buildService()

    await service.create('splaro', {
      name: 'Eid hero',
      path: 'https://splaro.co/uploads/media/eid.webp',
      folder: 'media',
      width: 1600,
      height: 900,
    })

    expect(prisma.mediaAsset.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ path: '/uploads/media/eid.webp', storeId: 'store-1' }),
      }),
    )
  })

  it('rejects external and traversal paths', async () => {
    const { service } = buildService()

    await expect(
      service.create('splaro', { name: 'Bad', path: 'https://evil.test/file.webp' }),
    ).rejects.toBeInstanceOf(BadRequestException)
    await expect(
      service.create('splaro', { name: 'Bad', path: '/uploads/../secret' }),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('blocks deletion while asset is used by a hero', async () => {
    const { service, prisma } = buildService({
      id: 'media-1',
      storeId: 'store-1',
      path: '/uploads/media/eid.webp',
    })
    prisma.banner.findMany.mockResolvedValue([
      { id: 'hero-1', title: 'Eid Edit', position: 'hero' },
    ])

    await expect(service.remove('splaro', 'media-1')).rejects.toBeInstanceOf(ConflictException)
    expect(prisma.mediaAsset.delete).not.toHaveBeenCalled()
  })

  it('blocks deletion when a sibling pipeline variant is linked', async () => {
    const previousRoot = process.env.UPLOAD_DIR
    const root = await mkdtemp(path.join(tmpdir(), 'splaro-media-'))
    process.env.UPLOAD_DIR = root
    await mkdir(path.join(root, 'products'))
    await Promise.all([
      writeFile(path.join(root, 'products', '1700000000000-abc123.w1200.webp'), 'display'),
      writeFile(path.join(root, 'products', '1700000000000-abc123.w828.avif'), 'mobile'),
    ])
    const { service, prisma } = buildService({
      id: 'media-1',
      storeId: 'store-1',
      path: '/uploads/products/1700000000000-abc123.w1200.webp',
    })
    prisma.productImage.findMany.mockImplementation(async ({ where }: { where: { url: { in: string[] } } }) =>
      where.url.in.includes('/uploads/products/1700000000000-abc123.w828.avif')
        ? [{ id: 'image-1', product: { name: 'Linked mobile crop' } }]
        : [],
    )

    try {
      await expect(service.remove('splaro', 'media-1')).rejects.toBeInstanceOf(ConflictException)
      expect(prisma.mediaAsset.delete).not.toHaveBeenCalled()
    } finally {
      process.env.UPLOAD_DIR = previousRoot
      await rm(root, { recursive: true, force: true })
    }
  })

  it('orphan cleanup removes only known pipeline siblings', async () => {
    const previousRoot = process.env.UPLOAD_DIR
    const root = await mkdtemp(path.join(tmpdir(), 'splaro-media-'))
    process.env.UPLOAD_DIR = root
    await mkdir(path.join(root, 'products'))
    const prefix = '1700000000000-abc123'
    await Promise.all([
      writeFile(path.join(root, 'products', `${prefix}.original.jpg`), 'original'),
      writeFile(path.join(root, 'products', `${prefix}.w1200.webp`), 'display'),
      writeFile(path.join(root, 'products', `${prefix}.notes.txt`), 'keep'),
    ])
    const { service } = buildService()

    try {
      await service.removeOrphan('splaro', `/uploads/products/${prefix}.w1200.webp`)
      await expect(access(path.join(root, 'products', `${prefix}.original.jpg`))).rejects.toBeDefined()
      await expect(access(path.join(root, 'products', `${prefix}.w1200.webp`))).rejects.toBeDefined()
      await expect(access(path.join(root, 'products', `${prefix}.notes.txt`))).resolves.toBeUndefined()
    } finally {
      process.env.UPLOAD_DIR = previousRoot
      await rm(root, { recursive: true, force: true })
    }
  })

  it('blocks deletion when a store content block contains the image URL', async () => {
    const { service, prisma } = buildService({
      id: 'media-1',
      storeId: 'store-1',
      path: '/uploads/media/eid.webp',
    })
    prisma.contentBlock.findMany.mockResolvedValue([
      { id: 'content-1', title: 'Homepage hero', type: 'HERO_SLIDER', settings: { image: '/uploads/media/eid.webp' } },
    ])

    await expect(service.remove('splaro', 'media-1')).rejects.toBeInstanceOf(ConflictException)
    expect(prisma.mediaAsset.delete).not.toHaveBeenCalled()
  })

  it('reports every supported store usage surface', async () => {
    const { service, prisma } = buildService()
    const mediaPath = '/uploads/media/eid.webp'
    prisma.productImage.findMany.mockResolvedValue([{ id: 'pi', product: { name: 'Product' } }])
    prisma.productVariant.findMany.mockResolvedValue([{ id: 'pv', product: { name: 'Product' }, colorName: 'Navy', size: 'M' }])
    prisma.banner.findMany.mockResolvedValue([{ id: 'hero', title: 'Hero', position: 'hero' }])
    prisma.category.findMany.mockResolvedValue([{ id: 'cat', name: 'Men' }])
    prisma.collection.findMany.mockResolvedValue([{ id: 'col', name: 'Eid' }])
    prisma.orderItem.findMany.mockResolvedValue([{ id: 'order', productName: 'Shirt', order: { invoiceNumber: 'SPL-1' } }])
    prisma.store.findUnique.mockResolvedValue({
      id: 'store-1', name: 'SPLARO', logo: mediaPath, favicon: null,
      owner: { id: 'owner', firstName: 'Store', lastName: 'Owner', avatar: mediaPath },
    })
    prisma.brand.findMany.mockResolvedValue([{ id: 'brand', name: 'SPLARO' }])
    prisma.blogPost.findMany.mockResolvedValue([{ id: 'blog', title: 'Story', featuredImage: mediaPath, content: '', schemaMarkup: null }])
    prisma.seoConfig.findMany.mockResolvedValue([{ id: 'seo', resourceType: 'page', resourceId: 'home', ogImage: mediaPath, twitterImage: null, schemaData: null }])
    prisma.wholesaleStockImage.findMany.mockResolvedValue([{ id: 'wholesale', title: 'Stock' }])
    prisma.partner.findMany.mockResolvedValue([{ id: 'partner', name: 'Partner' }])
    prisma.staffRole.findMany.mockResolvedValue([{ id: 'staff', user: { firstName: 'Admin', lastName: 'User' } }])
    prisma.contentBlock.findMany.mockResolvedValue([{ id: 'content', title: 'Block', type: 'BANNER', settings: { image: mediaPath } }])
    prisma.sitePage.findMany.mockResolvedValue([{ id: 'page', title: 'About', slug: 'about', content: mediaPath, customCss: null, customJs: null }])
    prisma.siteSettings.findUnique.mockResolvedValue({ id: 'settings', storefrontConfig: { image: mediaPath }, customHeadScripts: null, customBodyScripts: null, customCss: null })
    prisma.menuItem.findMany.mockResolvedValue([{ id: 'menu', label: 'Editorial', url: null, megaMenuData: { image: mediaPath } }])

    const usage = await service.usage('store-1', mediaPath)

    expect(new Set(usage.map((item) => item.type))).toEqual(new Set([
      'product', 'variant', 'hero', 'category', 'collection', 'order', 'store', 'staff',
      'brand', 'blog', 'seo', 'wholesale', 'partner', 'content', 'page', 'settings', 'menu',
    ]))
  })

  it('refuses orphan cleanup for an indexed asset', async () => {
    const { service } = buildService({
      id: 'media-1',
      storeId: 'store-1',
      path: '/uploads/media/eid.webp',
    })

    await expect(service.removeOrphan('splaro', '/uploads/media/eid.webp'))
      .rejects.toBeInstanceOf(ConflictException)
  })

  it('rejects unsafe orphan cleanup paths', async () => {
    const { service } = buildService()

    await expect(service.removeOrphan('splaro', '/uploads/../secret'))
      .rejects.toBeInstanceOf(BadRequestException)
  })

  it('creates a declared folder so empty chips can exist', async () => {
    const { service, prisma } = buildService()
    prisma.mediaFolder.upsert.mockResolvedValue({ slug: 'eid-2026', label: 'Eid 2026' })

    const folder = await service.createFolder('splaro', 'Eid 2026')

    expect(folder).toEqual(expect.objectContaining({ name: 'eid-2026', builtIn: false, count: 0 }))
    expect(prisma.mediaFolder.upsert).toHaveBeenCalled()
  })

  it('refuses to delete a built-in or non-empty folder', async () => {
    const { service, prisma } = buildService()

    await expect(service.deleteFolder('splaro', 'media')).rejects.toBeInstanceOf(BadRequestException)
    prisma.mediaAsset.count.mockResolvedValueOnce(2)
    await expect(service.deleteFolder('splaro', 'eid-2026')).rejects.toBeInstanceOf(ConflictException)
  })

  it('reports upload-volume stats without inventing a size when statfs works', async () => {
    const previousRoot = process.env.UPLOAD_DIR
    const root = await mkdtemp(path.join(tmpdir(), 'splaro-media-'))
    process.env.UPLOAD_DIR = root
    const { service } = buildService()
    try {
      const result = await service.storage('splaro')
      expect(result.libraryBytes).toBe(0)
      expect(result.libraryAssets).toBe(0)
      if (result.volume) {
        expect(result.volume.totalBytes).toBeGreaterThan(0)
        expect(result.volume.usedBytes).toBeGreaterThanOrEqual(0)
      }
    } finally {
      process.env.UPLOAD_DIR = previousRoot
      await rm(root, { recursive: true, force: true })
    }
  })

  it('bills pipeline derivatives to the asset that spawned them', async () => {
    const previousRoot = process.env.UPLOAD_DIR
    const root = await mkdtemp(path.join(tmpdir(), 'splaro-media-'))
    process.env.UPLOAD_DIR = root
    await mkdir(path.join(root, 'products'))
    const prefix = '1700000000000-abc123'
    await Promise.all([
      writeFile(path.join(root, 'products', `${prefix}.webp`), 'x'.repeat(100)),
      writeFile(path.join(root, 'products', `${prefix}.original.jpg`), 'x'.repeat(400)),
      writeFile(path.join(root, 'products', `${prefix}.w640.webp`), 'x'.repeat(60)),
      writeFile(path.join(root, 'products', '1699999999999-zzz999.webp'), 'x'.repeat(30)),
    ])
    const { service, prisma } = buildService()
    prisma.mediaAsset.findMany.mockResolvedValue([
      {
        id: 'media-1',
        name: 'Shirt',
        path: `/uploads/products/${prefix}.webp`,
        folder: 'men',
        kind: 'image',
        mimeType: 'image/webp',
        sizeBytes: 100,
        createdAt: new Date(),
        deletedAt: null,
      },
    ])

    try {
      const result = await service.storage('splaro')
      expect(result.split.indexedBytes).toBe(100)
      expect(result.split.derivativeBytes).toBe(460)
      // The unindexed upload is the only thing left over.
      expect(result.split.orphanBytes).toBe(30)
      expect(result.split.orphanFiles).toBe(1)
      expect(result.libraryBytes).toBe(560)
      expect(result.byFolder).toEqual([
        expect.objectContaining({ slug: 'men', bytes: 560, count: 1 }),
      ])
      expect(result.largest[0]).toEqual(expect.objectContaining({ id: 'media-1', bytes: 560 }))
      expect(result.byMonth).toHaveLength(12)
      expect(result.byMonth[11]).toEqual(expect.objectContaining({ cumulativeBytes: 560 }))
    } finally {
      process.env.UPLOAD_DIR = previousRoot
      await rm(root, { recursive: true, force: true })
    }
  })

  it('reads a configured quota rather than trusting the host volume size', async () => {
    const previousRoot = process.env.UPLOAD_DIR
    const previousQuota = process.env.MEDIA_QUOTA_BYTES
    const root = await mkdtemp(path.join(tmpdir(), 'splaro-media-'))
    process.env.UPLOAD_DIR = root
    process.env.MEDIA_QUOTA_BYTES = '200GB'
    const { service } = buildService()

    try {
      const result = await service.storage('splaro')
      expect(result.volume?.quotaBytes).toBe(200 * 1024 ** 3)
    } finally {
      process.env.UPLOAD_DIR = previousRoot
      process.env.MEDIA_QUOTA_BYTES = previousQuota
      await rm(root, { recursive: true, force: true })
    }
  })

  it('groups orphan files by upload family and holds back in-flight uploads', async () => {
    const previousRoot = process.env.UPLOAD_DIR
    const root = await mkdtemp(path.join(tmpdir(), 'splaro-media-'))
    process.env.UPLOAD_DIR = root
    await mkdir(path.join(root, 'products'))
    await Promise.all([
      writeFile(path.join(root, 'products', '1700000000000-abc123.webp'), 'x'.repeat(50)),
      writeFile(path.join(root, 'products', '1700000000000-abc123.w640.webp'), 'x'.repeat(20)),
      writeFile(path.join(root, 'products', '1700000000001-def456.pending'), 'x'),
    ])
    const { service } = buildService()

    try {
      const result = await service.orphans('splaro')
      expect(result.total).toBe(2)
      const family = result.orphans.find((row) => row.familyKey.endsWith('1700000000000-abc123'))
      expect(family).toEqual(
        expect.objectContaining({
          path: '/uploads/products/1700000000000-abc123.webp',
          bytes: 70,
          files: 2,
        }),
      )
      const pending = result.orphans.find((row) => row.pending)
      expect(pending?.purgeSafe).toBe(false)
    } finally {
      process.env.UPLOAD_DIR = previousRoot
      await rm(root, { recursive: true, force: true })
    }
  })

  it('leaves indexed uploads out of the orphan list', async () => {
    const previousRoot = process.env.UPLOAD_DIR
    const root = await mkdtemp(path.join(tmpdir(), 'splaro-media-'))
    process.env.UPLOAD_DIR = root
    await mkdir(path.join(root, 'media'))
    await writeFile(path.join(root, 'media', '1700000000000-abc123.webp'), 'x')
    const { service, prisma } = buildService()
    prisma.mediaAsset.findMany.mockResolvedValue([
      { path: '/uploads/media/1700000000000-abc123.webp' },
    ])

    try {
      const result = await service.orphans('splaro')
      expect(result.total).toBe(0)
    } finally {
      process.env.UPLOAD_DIR = previousRoot
      await rm(root, { recursive: true, force: true })
    }
  })

  it('does not expose assets from another store', async () => {
    const { service } = buildService(null)

    await expect(service.update('splaro', 'other-store-media', { name: 'Nope' }))
      .rejects.toBeInstanceOf(NotFoundException)
  })

  it('moves unlinked assets to trash on first delete', async () => {
    const { service, prisma } = buildService({
      id: 'media-1',
      storeId: 'store-1',
      path: '/uploads/media/already-gone.webp',
      deletedAt: null,
    })

    const result = await service.remove('splaro', 'media-1')

    expect(result).toEqual(expect.objectContaining({ deleted: true, trashed: true, fileDeleted: false }))
    expect(prisma.mediaAsset.update).toHaveBeenCalled()
    expect(prisma.mediaAsset.delete).not.toHaveBeenCalled()
  })

  it('permanently deletes a trashed unlinked asset', async () => {
    const { service, prisma } = buildService({
      id: 'media-1',
      storeId: 'store-1',
      path: '/uploads/media/already-gone.webp',
      deletedAt: new Date('2026-08-01'),
    })

    const result = await service.remove('splaro', 'media-1')

    expect(result).toEqual(expect.objectContaining({ deleted: true, trashed: false }))
    expect(prisma.mediaAsset.delete).toHaveBeenCalledWith({ where: { id: 'media-1' } })
  })

  it('permanently deletes a live asset only when the caller asks for it', async () => {
    const { service, prisma } = buildService({
      id: 'media-1',
      storeId: 'store-1',
      path: '/uploads/media/already-gone.webp',
      deletedAt: null,
    })

    const result = await service.remove('splaro', 'media-1', { permanent: true })

    expect(result).toEqual(expect.objectContaining({ deleted: true, trashed: false }))
    expect(prisma.mediaAsset.delete).toHaveBeenCalledWith({ where: { id: 'media-1' } })
  })

  it('still refuses a permanent delete while the asset is linked', async () => {
    const { service, prisma } = buildService({
      id: 'media-1',
      storeId: 'store-1',
      path: '/uploads/media/eid.webp',
    })
    prisma.banner.findMany.mockResolvedValue([{ id: 'hero-1', title: 'Eid Edit', position: 'hero' }])

    await expect(service.remove('splaro', 'media-1', { permanent: true }))
      .rejects.toBeInstanceOf(ConflictException)
    expect(prisma.mediaAsset.delete).not.toHaveBeenCalled()
  })

  it('moves assets only into a folder that exists', async () => {
    const { service, prisma } = buildService()
    prisma.mediaAsset.updateMany.mockResolvedValue({ count: 2 })
    prisma.mediaFolder.findFirst.mockResolvedValue(null)

    await expect(service.bulkMove('splaro', ['a'], 'eid-2026')).rejects.toBeInstanceOf(NotFoundException)

    const moved = await service.bulkMove('splaro', ['a', 'b'], 'men')
    expect(moved).toEqual({ moved: 2, folder: 'men' })
    expect(prisma.mediaAsset.updateMany).toHaveBeenCalledWith({
      where: { storeId: 'store-1', id: { in: ['a', 'b'] }, deletedAt: null },
      data: { folder: 'men' },
    })
  })

  it('restores a trashed asset', async () => {
    const { service } = buildService({
      id: 'media-1',
      storeId: 'store-1',
      path: '/uploads/media/eid.webp',
      deletedAt: new Date(),
    })
    const restored = await service.restore('splaro', 'media-1')
    expect(restored.restored).toBe(true)
  })

  it('lists only duplicate hashes', async () => {
    const { service, prisma } = buildService()
    prisma.mediaAsset.findMany.mockResolvedValue([
      { id: 'a', path: '/uploads/media/a.webp', contentHash: 'abc' },
      { id: 'b', path: '/uploads/media/b.webp', contentHash: 'abc' },
      { id: 'c', path: '/uploads/media/c.webp', contentHash: 'zzz' },
    ])
    const listed = await service.list('splaro', undefined, undefined, { duplicates: true })
    expect(listed.assets.map((row) => row.id)).toEqual(['a', 'b'])
  })

  it('collects catalogue image URLs once, from images and variants alike', async () => {
    const { service, prisma } = buildService()
    prisma.productImage.findMany.mockResolvedValue([
      { url: '/uploads/products-men/shirt.webp' },
      { url: '/uploads/products-men/shared.webp' },
      { url: '  ' },
    ])
    prisma.productVariant.findMany.mockResolvedValue([
      { image: '/uploads/products-men/shared.webp' },
      { image: '/uploads/products-men/blue.webp' },
      { image: null },
    ])

    const { paths } = await service.productUsagePaths('splaro')

    expect(paths).toEqual([
      '/uploads/products-men/shirt.webp',
      '/uploads/products-men/shared.webp',
      '/uploads/products-men/blue.webp',
    ])
  })

  it('leaves the product being edited out of its own usage set', async () => {
    const { service, prisma } = buildService()

    await service.productUsagePaths('splaro', 'product-1')

    const scope = { storeId: 'store-1', id: { not: 'product-1' } }
    expect(prisma.productImage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { product: scope } }),
    )
    expect(prisma.productVariant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { product: scope, image: { not: null } } }),
    )
  })
})
