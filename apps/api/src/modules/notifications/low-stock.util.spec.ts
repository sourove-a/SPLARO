import type { PrismaService } from '../../common/prisma.service'
import { findLowStockVariants } from './low-stock.util'

type Variant = {
  id: string
  sku: string | null
  stock: number
  product: { name: string; lowStockThreshold: number | null }
}

function buildPrisma(variants: Variant[]) {
  const findMany = jest.fn().mockResolvedValue(variants)
  return {
    prisma: { productVariant: { findMany } } as unknown as PrismaService,
    findMany,
  }
}

const variant = (over: Partial<Variant> & { id: string }): Variant => ({
  sku: `SKU-${over.id}`,
  stock: 0,
  product: { name: `Product ${over.id}`, lowStockThreshold: 5 },
  ...over,
})

describe('findLowStockVariants', () => {
  it('scopes the query to the store and skips archived products', async () => {
    const { prisma, findMany } = buildPrisma([])
    await findLowStockVariants(prisma, 'store-1')

    const where = findMany.mock.calls[0]![0].where
    expect(where.isActive).toBe(true)
    expect(where.product.storeId).toBe('store-1')
    expect(where.product.status).toEqual({ not: 'ARCHIVED' })
  })

  it('honours each product threshold rather than the query prefilter', async () => {
    const { prisma } = buildPrisma([
      // Bulk item: 12 left but reorders at 20, so it is short.
      variant({ id: 'a', stock: 12, product: { name: 'Bulk tee', lowStockThreshold: 20 } }),
      // Same stock, ordinary threshold — not short.
      variant({ id: 'b', stock: 12, product: { name: 'Kaftan', lowStockThreshold: 5 } }),
    ])

    const rows = await findLowStockVariants(prisma, 'store-1')
    expect(rows.map((r) => r.productName)).toEqual(['Bulk tee'])
    expect(rows[0]!.threshold).toBe(20)
  })

  it('includes out-of-stock variants — zero is the worst case, not a separate one', async () => {
    const { prisma } = buildPrisma([variant({ id: 'a', stock: 0 })])
    const rows = await findLowStockVariants(prisma, 'store-1')
    expect(rows).toHaveLength(1)
    expect(rows[0]!.stock).toBe(0)
  })

  it('treats a variant exactly at its threshold as short', async () => {
    const { prisma } = buildPrisma([variant({ id: 'a', stock: 5 })])
    expect(await findLowStockVariants(prisma, 'store-1')).toHaveLength(1)
  })

  it('defaults a missing threshold to five', async () => {
    const { prisma } = buildPrisma([
      variant({ id: 'a', stock: 6, product: { name: 'No threshold', lowStockThreshold: null } }),
      variant({ id: 'b', stock: 4, product: { name: 'Also none', lowStockThreshold: null } }),
    ])
    const rows = await findLowStockVariants(prisma, 'store-1')
    expect(rows.map((r) => r.productName)).toEqual(['Also none'])
  })

  it('falls back to the variant id when a SKU was never set', async () => {
    const { prisma } = buildPrisma([variant({ id: 'v-99', sku: null, stock: 1 })])
    expect((await findLowStockVariants(prisma, 'store-1'))[0]!.sku).toBe('v-99')
  })

  it('caps the result so one bad import cannot flood the tray', async () => {
    const many = Array.from({ length: 40 }, (_, i) => variant({ id: String(i), stock: 0 }))
    const { prisma } = buildPrisma(many)
    expect(await findLowStockVariants(prisma, 'store-1', 20)).toHaveLength(20)
    expect(await findLowStockVariants(prisma, 'store-1')).toHaveLength(40)
  })
})
