import { BadRequestException } from '@nestjs/common'
import type { CacheService } from '../../common/cache.service'
import type { PrismaService } from '../../common/prisma.service'
import { CategoriesController } from './categories.controller'

jest.mock('../products/product-catalog-refresh.util', () => ({
  refreshCategoryCatalogAfterMutation: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('../products/category-code.service', () => ({
  issueCategoryCode: jest.fn().mockResolvedValue('410'),
}))

const STORE = { id: 'store-1' }

/** Women → Kameez → Single Kameez, the shape the dashboard renders. */
const TREE = [
  { id: 'women', parentId: null, storeId: STORE.id },
  { id: 'kameez', parentId: 'women', storeId: STORE.id },
  { id: 'single', parentId: 'kameez', storeId: STORE.id },
]

function buildController(rows = TREE) {
  const created = jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
    id: 'new',
    ...data,
  }))
  const update = jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
    id: 'kameez',
    ...data,
  }))

  const prisma = {
    store: { findFirst: jest.fn().mockResolvedValue(STORE) },
    category: {
      findMany: jest.fn().mockResolvedValue(rows),
      findFirst: jest.fn(({ where }: { where: { id: string; storeId: string } }) =>
        Promise.resolve(
          rows.find((row) => row.id === where.id && row.storeId === where.storeId) ?? null,
        ),
      ),
      findUnique: jest.fn().mockResolvedValue(null),
      aggregate: jest.fn().mockResolvedValue({ _max: { sortOrder: 3 } }),
      update,
    },
    $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({ category: { create: created }, $executeRaw: jest.fn() }),
    ),
  } as unknown as PrismaService

  const cache = {} as unknown as CacheService
  return { controller: new CategoriesController(prisma, cache), created, update }
}

describe('CategoriesController', () => {
  it('creates a top-level category when no parent is given', async () => {
    const { controller, created } = buildController()

    const row = (await controller.create('splaro', { name: 'Gift Hampers' })) as {
      slug: string
      parentId: string | null
    }

    expect(created).toHaveBeenCalledTimes(1)
    expect(row.slug).toBe('gift-hampers')
    expect(row.parentId).toBeNull()
  })

  it('treats an empty parentId as top level rather than a broken foreign key', async () => {
    const { controller } = buildController()

    const row = (await controller.create('splaro', { name: 'Gifts', parentId: '  ' })) as {
      parentId: string | null
    }

    expect(row.parentId).toBeNull()
  })

  it('refuses a parent that is not a category on this store', async () => {
    const { controller } = buildController()

    await expect(controller.create('splaro', { name: 'Gifts', parentId: 'ghost' })).rejects.toThrow(
      BadRequestException,
    )
  })

  it('refuses a category with no name', async () => {
    const { controller } = buildController()

    await expect(controller.create('splaro', { name: '   ' })).rejects.toThrow(BadRequestException)
  })

  it('refuses to move a category under its own descendant', async () => {
    const { controller } = buildController()

    // Women > Kameez > Single Kameez — parking Kameez under Single Kameez would
    // orphan the whole branch out of the tree.
    await expect(controller.update('kameez', { parentId: 'single' })).rejects.toThrow(
      BadRequestException,
    )
  })

  it('allows a real re-parent', async () => {
    const { controller, update } = buildController()

    await controller.update('single', { parentId: 'women' })

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ parentId: 'women' }) }),
    )
  })

  it('promotes a category to top level when parentId is cleared', async () => {
    const { controller, update } = buildController()

    await controller.update('kameez', { parentId: null })

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ parentId: null }) }),
    )
  })
})
