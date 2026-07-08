import type { Prisma } from '@prisma/client'

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
    AND: andClauses,
  }
}
