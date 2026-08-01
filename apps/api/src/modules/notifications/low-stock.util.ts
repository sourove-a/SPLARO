import type { PrismaService } from '../../common/prisma.service'

/**
 * Cheap prefilter so Postgres never scans the whole catalogue. The authoritative
 * test is each product's own `lowStockThreshold`, applied in memory below; this
 * ceiling only has to be >= the largest threshold anyone realistically sets.
 */
const STOCK_PREFILTER_CEILING = 50

export interface LowStockVariant {
  variantId: string
  sku: string
  productName: string
  stock: number
  threshold: number
}

/**
 * The single definition of "low stock" — used by the alert cron, the summary
 * endpoint and the manual trigger, so all three can never disagree about which
 * SKUs are short. Out-of-stock variants are included: zero is the worst case,
 * not a separate one.
 */
export async function findLowStockVariants(
  prisma: PrismaService,
  storeId: string,
  limit?: number,
): Promise<LowStockVariant[]> {
  const variants = await prisma.productVariant.findMany({
    where: {
      isActive: true,
      product: { storeId, status: { not: 'ARCHIVED' } },
      stock: { lte: STOCK_PREFILTER_CEILING },
    },
    orderBy: { stock: 'asc' },
    include: { product: { select: { name: true, lowStockThreshold: true } } },
  })

  const rows = variants
    .map((v) => ({
      variantId: v.id,
      sku: v.sku ?? v.id,
      productName: v.product.name,
      stock: v.stock,
      threshold: v.product.lowStockThreshold ?? 5,
    }))
    .filter((row) => row.stock <= row.threshold)

  return typeof limit === 'number' ? rows.slice(0, limit) : rows
}
