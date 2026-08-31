import { BadRequestException, NotFoundException } from '@nestjs/common'
import type { CacheService } from '../../common/cache.service'
import type { PrismaService } from '../../common/prisma.service'
import { ProductsController } from './products.controller'

jest.mock('../../common/revalidate-web', () => ({ revalidateStorefrontWeb: jest.fn() }))

/**
 * Rows swept before the variant goes: reservation items restrict the delete,
 * and a cart line would otherwise survive pointing at nothing. InventoryLog is
 * deliberately absent — its FK nulls the column and keeps the stock ledger.
 */
const SWEPT_TABLES = ['stockReservationItem', 'cartItem'] as const

const PRODUCT = { id: 'p1', storeId: 'store-1' }
const VARIANT = { id: 'v1', size: '38', colorName: 'Black / White', color: 'black' }

interface Commitments {
  sold?: number
  purchased?: number
  reserved?: number
}

function buildController(
  product: { id: string; storeId: string } | null = PRODUCT,
  variant: typeof VARIANT | null = VARIANT,
  commitments: Commitments = {},
) {
  const deletes = Object.fromEntries(
    SWEPT_TABLES.map((t) => [t, { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) }]),
  ) as Record<(typeof SWEPT_TABLES)[number], { deleteMany: jest.Mock }>

  const variantDelete = jest.fn().mockResolvedValue({ id: 'v1' })
  const inventoryLogDelete = jest.fn().mockResolvedValue({ count: 0 })
  const tx = {
    ...deletes,
    inventoryLog: { deleteMany: inventoryLogDelete },
    productVariant: { delete: variantDelete },
  }

  const prisma = {
    product: { findUnique: jest.fn().mockResolvedValue(product) },
    productVariant: { findFirst: jest.fn().mockResolvedValue(variant) },
    orderItem: { count: jest.fn().mockResolvedValue(commitments.sold ?? 0) },
    purchaseOrderItem: { count: jest.fn().mockResolvedValue(commitments.purchased ?? 0) },
    stockReservationItem: { count: jest.fn().mockResolvedValue(commitments.reserved ?? 0) },
    $transaction: jest.fn(async (fn: (t: unknown) => Promise<unknown>) => fn(tx)),
  } as unknown as PrismaService

  const cache = {
    invalidateStoreResource: jest.fn().mockResolvedValue(undefined),
  } as unknown as CacheService
  const search = { indexProducts: jest.fn() }

  const controller = new ProductsController(
    prisma,
    {} as never, // productAdvanced
    {} as never, // variantSku
    {} as never, // barcodes
    {} as never, // translator
    cache,
    search as never,
  )
  return { controller, prisma, deletes, variantDelete, inventoryLogDelete, search }
}

const req = (storeId?: string) => ({ adminUser: storeId ? { storeId } : undefined }) as never

describe('ProductsController variant delete', () => {
  it('clears the restricting rows and keeps the stock ledger', async () => {
    const { controller, deletes, variantDelete, inventoryLogDelete } = buildController()

    await expect(controller.destroyVariant('p1', 'v1', req())).resolves.toEqual({
      success: true,
      deleted: 'v1',
    })

    for (const table of SWEPT_TABLES) {
      expect(deletes[table].deleteMany).toHaveBeenCalledWith({ where: { variantId: 'v1' } })
    }
    expect(inventoryLogDelete).not.toHaveBeenCalled()
    expect(variantDelete).toHaveBeenCalledWith({ where: { id: 'v1' } })
  })

  it('refuses once the size appears on an order, and says to archive instead', async () => {
    const { controller, variantDelete } = buildController(PRODUCT, VARIANT, { sold: 2 })

    await expect(controller.destroyVariant('p1', 'v1', req())).rejects.toBeInstanceOf(
      BadRequestException,
    )
    await expect(controller.destroyVariant('p1', 'v1', req())).rejects.toThrow(
      /38 \/ Black \/ White.*2 order items.*[Aa]rchive/is,
    )
    expect(variantDelete).not.toHaveBeenCalled()
  })

  it('refuses a size a supplier order still points at', async () => {
    const { controller, variantDelete } = buildController(PRODUCT, VARIANT, { purchased: 1 })

    await expect(controller.destroyVariant('p1', 'v1', req())).rejects.toThrow(
      /purchase order line/i,
    )
    expect(variantDelete).not.toHaveBeenCalled()
  })

  it('refuses while a live checkout is holding the stock', async () => {
    const { controller, prisma, variantDelete } = buildController(PRODUCT, VARIANT, { reserved: 1 })

    await expect(controller.destroyVariant('p1', 'v1', req())).rejects.toThrow(/checkout in progress/i)
    expect(
      (prisma as unknown as { stockReservationItem: { count: jest.Mock } }).stockReservationItem.count,
    ).toHaveBeenCalledWith({ where: { variantId: 'v1', reservation: { status: 'ACTIVE' } } })
    expect(variantDelete).not.toHaveBeenCalled()
  })

  it('hides a product owned by another store', async () => {
    const { controller, variantDelete } = buildController()

    await expect(controller.destroyVariant('p1', 'v1', req('other-store'))).rejects.toBeInstanceOf(
      NotFoundException,
    )
    expect(variantDelete).not.toHaveBeenCalled()
  })

  it('404s on a missing product or variant', async () => {
    await expect(
      buildController(null).controller.destroyVariant('p1', 'v1', req()),
    ).rejects.toBeInstanceOf(NotFoundException)
    await expect(
      buildController(PRODUCT, null).controller.destroyVariant('p1', 'v1', req()),
    ).rejects.toBeInstanceOf(NotFoundException)
  })

  it('reindexes the product so the storefront drops the size', async () => {
    const { controller, search } = buildController()
    await controller.destroyVariant('p1', 'v1', req())
    expect(search.indexProducts).toHaveBeenCalledWith('store-1')
  })
})
