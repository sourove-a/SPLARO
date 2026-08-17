import { BadRequestException, NotFoundException } from '@nestjs/common'
import type { CacheService } from '../../common/cache.service'
import type { PrismaService } from '../../common/prisma.service'
import { ProductsController } from './products.controller'

jest.mock('../../common/revalidate-web', () => ({ revalidateStorefrontWeb: jest.fn() }))

/**
 * Every table that holds Product or ProductVariant by a restricting foreign
 * key. Miss one and Postgres refuses the delete at runtime, so the delete
 * sequence is asserted table by table rather than "it did not throw".
 */
const BLOCKING_TABLES = [
  'stockReservationItem',
  'cartItem',
  'inventoryLog',
  'review',
  'aIJob',
] as const

function buildController(
  product: { id: string; storeId: string; name: string } | null,
  orderItemCount = 0,
) {
  const deletes = Object.fromEntries(
    BLOCKING_TABLES.map((t) => [t, { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) }]),
  ) as Record<(typeof BLOCKING_TABLES)[number], { deleteMany: jest.Mock }>

  const productDelete = jest.fn().mockResolvedValue({ id: product?.id })
  // The handler also releases the product's ledger row (keeping the code
  // reserved, clearing the owner), which is a raw statement.
  const executeRaw = jest.fn().mockResolvedValue(1)
  const tx = { ...deletes, product: { delete: productDelete }, $executeRaw: executeRaw }

  const prisma = {
    product: { findUnique: jest.fn().mockResolvedValue(product) },
    orderItem: { count: jest.fn().mockResolvedValue(orderItemCount) },
    $transaction: jest.fn(async (fn: (t: unknown) => Promise<unknown>) => fn(tx)),
  } as unknown as PrismaService

  const cache = {
    invalidateStoreResource: jest.fn().mockResolvedValue(undefined),
  } as unknown as CacheService
  const search = { deleteFromIndex: jest.fn() }

  const controller = new ProductsController(
    prisma,
    {} as never, // productAdvanced
    {} as never, // variantSku
    {} as never, // barcodes
    {} as never, // translator
    cache,
    search as never,
  )
  return { controller, prisma, deletes, productDelete, search }
}

const PRODUCT = { id: 'p1', storeId: 'store-1', name: 'Meherjaan Silk Kaftan' }
const req = (storeId?: string) => ({ adminUser: storeId ? { storeId } : undefined }) as never

describe('ProductsController permanent delete', () => {
  it('clears every restricting relation before removing the product', async () => {
    const { controller, deletes, productDelete } = buildController(PRODUCT)

    await expect(controller.destroy('p1', req())).resolves.toEqual({
      success: true,
      deleted: 'p1',
    })

    for (const table of BLOCKING_TABLES) {
      expect(deletes[table].deleteMany).toHaveBeenCalledTimes(1)
    }
    expect(productDelete).toHaveBeenCalledWith({ where: { id: 'p1' } })
  })

  it('matches cart and inventory rows by variant as well as product', async () => {
    // A row carrying the variant key but a mismatched productId would survive a
    // product-only sweep and then block the variant cascade.
    const { controller, deletes } = buildController(PRODUCT)
    await controller.destroy('p1', req())

    for (const table of ['cartItem', 'inventoryLog'] as const) {
      expect(deletes[table].deleteMany).toHaveBeenCalledWith({
        where: { OR: [{ productId: 'p1' }, { variant: { productId: 'p1' } }] },
      })
    }
    expect(deletes.stockReservationItem.deleteMany).toHaveBeenCalledWith({
      where: { variant: { productId: 'p1' } },
    })
  })

  it('refuses once the product appears on an order', async () => {
    const { controller, productDelete } = buildController(PRODUCT, 3)

    await expect(controller.destroy('p1', req())).rejects.toBeInstanceOf(BadRequestException)
    expect(productDelete).not.toHaveBeenCalled()
  })

  it('names the product and the count so the operator knows what to do', async () => {
    const { controller } = buildController(PRODUCT, 1)

    await expect(controller.destroy('p1', req())).rejects.toThrow(
      /Meherjaan Silk Kaftan.*1 order item.*archive/is,
    )
  })

  it('rejects a product from another store as not found', async () => {
    const { controller, productDelete } = buildController(PRODUCT)

    await expect(controller.destroy('p1', req('other-store'))).rejects.toBeInstanceOf(
      NotFoundException,
    )
    expect(productDelete).not.toHaveBeenCalled()
  })

  it('404s on a product that does not exist', async () => {
    const { controller } = buildController(null)
    await expect(controller.destroy('missing', req())).rejects.toBeInstanceOf(NotFoundException)
  })

  it('drops the product from the search index and busts the cache', async () => {
    const { controller, search, prisma } = buildController(PRODUCT)
    await controller.destroy('p1', req())

    expect(search.deleteFromIndex).toHaveBeenCalledWith('p1')
    expect(
      (prisma as unknown as { product: { findUnique: jest.Mock } }).product.findUnique,
    ).toHaveBeenCalled()
  })
})
