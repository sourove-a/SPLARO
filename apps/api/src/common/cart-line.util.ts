import { BadRequestException } from '@nestjs/common'
import type { PrismaService } from './prisma.service'
import { storefrontVisibleProductWhere } from './storefront-product.util'

/** Matches checkout limit in storefront-orders.service.ts */
export const CART_MAX_LINE_QTY = 500

export const CART_MAX_LINES = 100

export function clampCartLineQuantity(raw: unknown): number {
  const qty = Math.round(Number(raw ?? 1))
  if (!Number.isFinite(qty)) return 1
  return Math.min(CART_MAX_LINE_QTY, Math.max(1, qty))
}

type CartVariantRow = { id: string; stock: number }

type CheckoutVariantRow = {
  id: string
  productId: string
  stock: number
  reservedStock: number
  sku: string | null
  image: string | null
  size?: string | null
  color?: string | null
  colorHex?: string | null
  colorName?: string | null
  price: { toString(): string }
  product: { basePrice: { toString(): string } }
}

export type { CheckoutVariantRow }

export type CheckoutVariantResolution =
  | { ok: true; variant: CheckoutVariantRow }
  | { ok: false; error: string }

export interface CheckoutLineInput {
  productId: string
  variantId?: string
  size?: string
  color?: string
  name: string
}

const checkoutVariantInclude = { product: { select: { basePrice: true } } } as const

function matchVariantBySizeColor(
  variants: CheckoutVariantRow[],
  size: string,
  color: string,
): CheckoutVariantRow[] {
  const colorLower = color.toLowerCase()
  return variants.filter((variant) => {
    const sizeOk = variant.size === size
    const colorOk =
      variant.color === color ||
      variant.colorHex?.toLowerCase() === colorLower ||
      variant.colorName?.toLowerCase() === colorLower
    return sizeOk && colorOk
  })
}

function resolveFromProductVariants(
  label: string,
  item: CheckoutLineInput,
  variants: CheckoutVariantRow[],
): CheckoutVariantResolution {
  if (!variants.length) {
    return { ok: false, error: `${label}: no sellable variants` }
  }

  const variantId = item.variantId?.trim()
  if (variantId) {
    const byId = variants.find((variant) => variant.id === variantId)
    if (!byId) {
      return { ok: false, error: `${label}: selected variant is no longer available` }
    }
    return { ok: true, variant: byId }
  }

  if (variants.length === 1) {
    return { ok: true, variant: variants[0]! }
  }

  const size = item.size?.trim()
  const color = item.color?.trim()
  if (!size || !color) {
    return { ok: false, error: `${label}: select size and color (variant required)` }
  }

  const matches = matchVariantBySizeColor(variants, size, color)
  if (matches.length === 1) return { ok: true, variant: matches[0]! }
  if (matches.length > 1) {
    return { ok: false, error: `${label}: ambiguous size/color — refresh and reselect` }
  }
  return { ok: false, error: `${label}: selected size/color is not available` }
}

/** Strict checkout variant — no silent fallback to a cheaper/different SKU. */
export async function resolveCheckoutVariant(
  prisma: PrismaService,
  storeId: string,
  item: CheckoutLineInput,
): Promise<CheckoutVariantResolution> {
  const label = item.name?.trim() || 'Item'
  const productWhere = storefrontVisibleProductWhere({ storeId, id: item.productId })
  const base = { productId: item.productId, isActive: true, product: productWhere }

  const variantId = item.variantId?.trim()
  if (variantId) {
    const byId = await prisma.productVariant.findFirst({
      where: { id: variantId, ...base },
      include: checkoutVariantInclude,
    })
    if (!byId) {
      return { ok: false, error: `${label}: selected variant is no longer available` }
    }
    return { ok: true, variant: byId }
  }

  const variants = await prisma.productVariant.findMany({
    where: base,
    include: checkoutVariantInclude,
    orderBy: { createdAt: 'asc' },
  })

  return resolveFromProductVariants(label, item, variants)
}

/**
 * Batch resolve checkout lines — one findMany for all known variantIds, then
 * per-product fallback only for lines that still need size/color matching.
 */
export async function resolveCheckoutVariantsBatch(
  prisma: PrismaService,
  storeId: string,
  items: CheckoutLineInput[],
): Promise<CheckoutVariantResolution[]> {
  if (!items.length) return []

  const results: Array<CheckoutVariantResolution | undefined> = new Array(items.length)
  const byVariantId = new Map<string, number[]>()

  items.forEach((item, index) => {
    const variantId = item.variantId?.trim()
    if (!variantId) return
    const list = byVariantId.get(variantId) ?? []
    list.push(index)
    byVariantId.set(variantId, list)
  })

  if (byVariantId.size) {
    const ids = [...byVariantId.keys()]
    const rows = await prisma.productVariant.findMany({
      where: {
        id: { in: ids },
        isActive: true,
        product: storefrontVisibleProductWhere({ storeId }),
      },
      include: checkoutVariantInclude,
    })
    const found = new Map(rows.map((row) => [row.id, row]))
    for (const [variantId, indexes] of byVariantId) {
      const variant = found.get(variantId)
      for (const index of indexes) {
        const label = items[index]?.name?.trim() || 'Item'
        results[index] = variant
          ? { ok: true, variant }
          : { ok: false, error: `${label}: selected variant is no longer available` }
      }
    }
  }

  const pendingIndexes = items
    .map((item, index) => (results[index] ? -1 : index))
    .filter((index) => index >= 0)

  if (pendingIndexes.length) {
    const productIds = [
      ...new Set(pendingIndexes.map((index) => items[index]!.productId).filter(Boolean)),
    ]
    const rows = productIds.length
      ? await prisma.productVariant.findMany({
          where: {
            productId: { in: productIds },
            isActive: true,
            product: storefrontVisibleProductWhere({ storeId }),
          },
          include: checkoutVariantInclude,
          orderBy: { createdAt: 'asc' },
        })
      : []

    const byProduct = new Map<string, CheckoutVariantRow[]>()
    for (const row of rows) {
      const list = byProduct.get(row.productId) ?? []
      list.push(row)
      byProduct.set(row.productId, list)
    }

    for (const index of pendingIndexes) {
      const item = items[index]!
      const label = item.name?.trim() || 'Item'
      results[index] = resolveFromProductVariants(
        label,
        item,
        byProduct.get(item.productId) ?? [],
      )
    }
  }

  return results.map(
    (result, index) =>
      result ?? {
        ok: false as const,
        error: `${items[index]?.name?.trim() || 'Item'}: selected variant is no longer available`,
      },
  )
}

export type CartVariantResolveHints = {
  size?: string | null
  color?: string | null
}

/** Resolve an active sellable variant for cart writes (may pick default when unspecified). */
export async function resolveCartVariant(
  prisma: PrismaService,
  storeId: string,
  productId: string,
  variantId?: string | null,
  hints?: CartVariantResolveHints,
): Promise<CartVariantRow | null> {
  const productWhere = storefrontVisibleProductWhere({ storeId, id: productId })
  const base = { productId, isActive: true, product: productWhere }

  if (variantId) {
    return prisma.productVariant.findFirst({
      where: { id: variantId, ...base },
      select: { id: true, stock: true },
    })
  }

  const size = hints?.size?.trim()
  const color = hints?.color?.trim()
  if (size || color) {
    const rows = await prisma.productVariant.findMany({
      where: base,
      select: {
        id: true,
        stock: true,
        size: true,
        color: true,
        colorHex: true,
        colorName: true,
      },
      orderBy: [{ stock: 'desc' }, { createdAt: 'asc' }],
    })
    const colorLower = color?.toLowerCase()
    const matched = rows.find((row) => {
      const sizeOk = !size || row.size === size
      const colorOk =
        !colorLower ||
        row.color?.toLowerCase() === colorLower ||
        row.colorHex?.toLowerCase() === colorLower ||
        row.colorName?.toLowerCase() === colorLower
      return sizeOk && colorOk
    })
    if (matched) return { id: matched.id, stock: matched.stock }
  }

  return (
    (await prisma.productVariant.findFirst({
      where: { ...base, stock: { gte: 1 } },
      select: { id: true, stock: true },
      orderBy: [{ stock: 'desc' }, { createdAt: 'asc' }],
    })) ??
    (await prisma.productVariant.findFirst({
      where: base,
      select: { id: true, stock: true },
      orderBy: [{ stock: 'desc' }, { createdAt: 'asc' }],
    }))
  )
}

export function assertCartLineStock(
  productLabel: string,
  requestedQty: number,
  availableStock: number,
): void {
  if (availableStock < 1) {
    throw new BadRequestException(`${productLabel}: out of stock`)
  }
  if (requestedQty > availableStock) {
    throw new BadRequestException(`${productLabel}: only ${availableStock} left in stock`)
  }
}

/** For cart sync — clamp or drop lines that exceed stock (non-fatal). */
export function clampCartLineToStock(requestedQty: unknown, availableStock: number): number | null {
  if (availableStock < 1) return null
  return Math.min(clampCartLineQuantity(requestedQty), availableStock)
}

export type CartReplaceLineInput = {
  productId?: string
  variantId?: string
  size?: string
  color?: string
  quantity?: number
}

/**
 * Batch-validate cart replace lines — few DB round-trips instead of N+1
 * product + variant lookups per line.
 */
export async function resolveCartReplaceLines(
  prisma: PrismaService,
  storeId: string,
  items: CartReplaceLineInput[],
): Promise<{ productId: string; variantId: string; quantity: number }[]> {
  if (!items.length) return []

  const productIds = [
    ...new Set(items.map((item) => item.productId?.trim()).filter((id): id is string => Boolean(id))),
  ]
  if (!productIds.length) return []

  const visibleProducts = await prisma.product.findMany({
    where: storefrontVisibleProductWhere({ storeId, id: { in: productIds } }),
    select: { id: true },
  })
  const visible = new Set(visibleProducts.map((row) => row.id))
  if (!visible.size) return []

  const variantIds = [
    ...new Set(
      items
        .map((item) => item.variantId?.trim())
        .filter((id): id is string => Boolean(id)),
    ),
  ]

  const byVariantId = new Map<string, CartVariantRow & { productId: string }>()
  if (variantIds.length) {
    const rows = await prisma.productVariant.findMany({
      where: {
        id: { in: variantIds },
        isActive: true,
        productId: { in: [...visible] },
        product: storefrontVisibleProductWhere({ storeId }),
      },
      select: { id: true, stock: true, productId: true },
    })
    for (const row of rows) {
      byVariantId.set(row.id, row)
    }
  }

  const needProductFallback = new Set<string>()
  for (const item of items) {
    const productId = item.productId?.trim()
    if (!productId || !visible.has(productId)) continue
    const variantId = item.variantId?.trim()
    if (variantId && byVariantId.has(variantId)) continue
    needProductFallback.add(productId)
  }

  const variantsByProduct = new Map<
    string,
    Array<{
      id: string
      stock: number
      size: string | null
      color: string | null
      colorHex: string | null
      colorName: string | null
    }>
  >()
  if (needProductFallback.size) {
    const rows = await prisma.productVariant.findMany({
      where: {
        productId: { in: [...needProductFallback] },
        isActive: true,
        product: storefrontVisibleProductWhere({ storeId }),
      },
      select: {
        id: true,
        stock: true,
        productId: true,
        size: true,
        color: true,
        colorHex: true,
        colorName: true,
      },
      orderBy: [{ stock: 'desc' }, { createdAt: 'asc' }],
    })
    for (const row of rows) {
      const list = variantsByProduct.get(row.productId) ?? []
      list.push(row)
      variantsByProduct.set(row.productId, list)
    }
  }

  const validated: { productId: string; variantId: string; quantity: number }[] = []
  for (const item of items) {
    const productId = item.productId?.trim()
    if (!productId || !visible.has(productId)) continue

    let resolved: CartVariantRow | null = null
    const variantId = item.variantId?.trim()
    if (variantId) {
      const hit = byVariantId.get(variantId)
      if (hit && hit.productId === productId) {
        resolved = { id: hit.id, stock: hit.stock }
      }
    }

    if (!resolved) {
      const rows = variantsByProduct.get(productId) ?? []
      const size = item.size?.trim()
      const color = item.color?.trim()
      if (size || color) {
        const colorLower = color?.toLowerCase()
        const matched = rows.find((row) => {
          const sizeOk = !size || row.size === size
          const colorOk =
            !colorLower ||
            row.color?.toLowerCase() === colorLower ||
            row.colorHex?.toLowerCase() === colorLower ||
            row.colorName?.toLowerCase() === colorLower
          return sizeOk && colorOk
        })
        if (matched) resolved = { id: matched.id, stock: matched.stock }
      }
      if (!resolved) {
        const inStock = rows.find((row) => row.stock >= 1)
        const fallback = inStock ?? rows[0]
        if (fallback) resolved = { id: fallback.id, stock: fallback.stock }
      }
    }

    if (!resolved) continue
    const quantity = clampCartLineToStock(item.quantity ?? 1, resolved.stock)
    if (quantity === null) continue
    validated.push({ productId, variantId: resolved.id, quantity })
  }

  return validated
}
