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
      update: jest.fn(),
      delete: jest.fn().mockResolvedValue({ id: 'media-1' }),
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

  it('does not expose assets from another store', async () => {
    const { service } = buildService(null)

    await expect(service.update('splaro', 'other-store-media', { name: 'Nope' }))
      .rejects.toBeInstanceOf(NotFoundException)
  })

  it('removes unlinked records idempotently when physical file is already missing', async () => {
    const { service, prisma } = buildService({
      id: 'media-1',
      storeId: 'store-1',
      path: '/uploads/media/already-gone.webp',
    })

    const result = await service.remove('splaro', 'media-1')

    expect(result).toEqual(expect.objectContaining({ deleted: true, fileDeleted: true }))
    expect(prisma.mediaAsset.delete).toHaveBeenCalledWith({ where: { id: 'media-1' } })
  })
})
