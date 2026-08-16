import type { Prisma } from '@prisma/client'

/**
 * Keep seeded demo SKUs off the live storefront.
 *
 * `sku`, `description` and `shortDescription` are all nullable, and SQL's
 * three-valued logic makes `NOT (a LIKE … OR b LIKE …)` evaluate to NULL — not
 * TRUE — as soon as one side is NULL. Written as a single `NOT { OR: [...] }`
 * this silently hid every real product that had no SKU or no short description.
 * Each field therefore gets its own null-tolerant clause.
 */
function demoCatalogExclusions(): Prisma.ProductWhereInput[] {
  return [
    { OR: [{ sku: null }, { NOT: { sku: { startsWith: 'DEMO-', mode: 'insensitive' } } }] },
    { OR: [{ sku: null }, { NOT: { sku: { contains: '-QA-', mode: 'insensitive' } } }] },
    {
      OR: [
        { description: null },
        { NOT: { description: { contains: 'seeded demo product', mode: 'insensitive' } } },
      ],
    },
    {
      OR: [
        { shortDescription: null },
        {
          NOT: { shortDescription: { contains: 'demo catalog for', mode: 'insensitive' } },
        },
      ],
    },
  ]
}

/** Products that may appear on the public storefront at the current moment. */
export function storefrontVisibleProductWhere(
  extra: Prisma.ProductWhereInput = {},
): Prisma.ProductWhereInput {
  const now = new Date()
  const { OR: extraOr, AND: extraAnd, ...rest } = extra

  const andClauses: Prisma.ProductWhereInput[] = [
    {
      OR: [{ publishAt: null }, { publishAt: { lte: now } }],
    },
  ]

  if (extraOr) {
    andClauses.unshift({ OR: extraOr })
  }
  if (extraAnd) {
    andClauses.push(...(Array.isArray(extraAnd) ? extraAnd : [extraAnd]))
  }

  return {
    ...rest,
    isPublished: true,
    isHidden: false,
    status: { not: 'ARCHIVED' },
    AND: [
      ...andClauses,
      ...demoCatalogExclusions(),
    ],
  }
}
