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
  stock: number
  reservedStock: number
  sku: string | null
  image: string | null
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

/** Strict checkout variant — no silent fallback to a cheaper/different SKU. */
export async function resolveCheckoutVariant(
  prisma: PrismaService,
  storeId: string,
  item: CheckoutLineInput,
): Promise<CheckoutVariantResolution> {
  const label = item.name?.trim() || 'Item'
  const productWhere = storefrontVisibleProductWhere({ storeId, id: item.productId })
  const base = { productId: item.productId, isActive: true, product: productWhere }
  const include = { product: { select: { basePrice: true } } } as const

  const variantId = item.variantId?.trim()
  if (variantId) {
    const byId = await prisma.productVariant.findFirst({
      where: { id: variantId, ...base },
      include,
    })
    if (!byId) {
      return { ok: false, error: `${label}: selected variant is no longer available` }
    }
    return { ok: true, variant: byId }
  }

  const variants = await prisma.productVariant.findMany({
    where: base,
    include,
    orderBy: { createdAt: 'asc' },
  })

  if (!variants.length) {
    return { ok: false, error: `${label}: no sellable variants` }
  }

  if (variants.length === 1) {
    return { ok: true, variant: variants[0]! }
  }

  const size = item.size?.trim()
  const color = item.color?.trim()
  if (!size || !color) {
    return { ok: false, error: `${label}: select size and color (variant required)` }
  }

  const colorLower = color.toLowerCase()
  const matches = variants.filter((variant) => {
    const sizeOk = variant.size === size
    const colorOk =
      variant.color === color ||
      variant.colorHex?.toLowerCase() === colorLower ||
      variant.colorName?.toLowerCase() === colorLower
    return sizeOk && colorOk
  })

  if (matches.length === 1) {
    return { ok: true, variant: matches[0]! }
  }

  if (matches.length > 1) {
    return { ok: false, error: `${label}: ambiguous size/color — refresh and reselect` }
  }

  return { ok: false, error: `${label}: selected size/color is not available` }
}

/** Resolve an active sellable variant for cart writes (may pick default when unspecified). */
export async function resolveCartVariant(
  prisma: PrismaService,
  storeId: string,
  productId: string,
  variantId?: string | null,
): Promise<CartVariantRow | null> {
  const productWhere = storefrontVisibleProductWhere({ storeId, id: productId })
  const base = { productId, isActive: true, product: productWhere }

  if (variantId) {
    return prisma.productVariant.findFirst({
      where: { id: variantId, ...base },
      select: { id: true, stock: true },
    })
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
