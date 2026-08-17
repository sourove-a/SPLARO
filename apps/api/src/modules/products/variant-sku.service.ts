import { BadRequestException, Injectable } from '@nestjs/common'
import type { Prisma } from '@prisma/client'
import {
  buildVariantIdentityBarcode,
  buildVariantIdentitySku,
  buildVariantSku,
  categoryCode,
  isValidCategoryCode,
  isValidSku,
  normalizeSku,
} from '@splaro/config'
import { PrismaService } from '../../common/prisma.service'

export interface VariantSkuInput {
  size?: string | null
  color?: string | null
  colorName?: string | null
}

/** The stable half of every SKU: SPL-{categoryCode}-{modelNumber}. */
export interface ProductSkuIdentity {
  categoryCode: string
  modelNumber: number
}

function colorLabel(variant: VariantSkuInput): string | null {
  return variant.colorName?.trim() || variant.color?.trim() || null
}

/* ── Standalone helpers ─────────────────────────────────────────
 * Exported as plain functions so the CSV importer, which runs outside Nest DI,
 * mints codes through exactly the same counters and format as the admin panel.
 */

/**
 * Next model number for this store + category, taken from the same atomic
 * counter table the barcodes use so two concurrent creates cannot collide on
 * the `(storeId, skuCategoryCode, skuModelNumber)` unique index.
 */
async function nextModelNumber(
  tx: Prisma.TransactionClient,
  storeId: string,
  code: string,
): Promise<number> {
  const key = `model:${storeId}:${code}`

  // Seed from existing data so a store that already has SPL-ABY-003 does not
  // restart at 001 the first time this counter is used.
  const highest = await tx.product.aggregate({
    where: { storeId, skuCategoryCode: code },
    _max: { skuModelNumber: true },
  })
  const seed = BigInt((highest._max.skuModelNumber ?? 0) + 1)

  await tx.$executeRaw`
    INSERT INTO "CodeSequence" ("key", "nextValue", "updatedAt")
    VALUES (${key}, ${seed}, NOW())
    ON CONFLICT ("key") DO NOTHING
  `

  const rows = await tx.$queryRaw<{ nextValue: bigint }[]>`
    UPDATE "CodeSequence"
    SET "nextValue" = GREATEST("nextValue", ${seed}) + 1, "updatedAt" = NOW()
    WHERE "key" = ${key}
    RETURNING "nextValue"
  `
  const after = rows[0]?.nextValue
  if (after === undefined) throw new Error(`Model counter ${key} is missing`)
  return Number(after - 1n)
}

/**
 * Allocate a fresh {categoryCode}-{styleSerial} identity for a new product.
 *
 * `categoryCodeOverride` is the category's permanent numeric code (410). It is
 * frozen onto the product here: moving the product to another storefront
 * category later must not rewrite SKUs that are already printed on labels and
 * referenced by orders. Only products created before category codes existed
 * fall back to the old three-letter code.
 */
export async function allocateProductIdentity(
  tx: Prisma.TransactionClient,
  input: { storeId: string; categoryLabel?: string | null; categoryCodeOverride?: string | null },
): Promise<ProductSkuIdentity> {
  const code = input.categoryCodeOverride?.trim() || categoryCode(input.categoryLabel ?? '')
  return { categoryCode: code, modelNumber: await nextModelNumber(tx, input.storeId, code) }
}

/** Read the product's identity, allocating and persisting one on first use. */
export async function ensureProductSkuIdentity(
  tx: Prisma.TransactionClient,
  input: { productId: string; storeId: string; categoryLabel?: string | null },
): Promise<ProductSkuIdentity> {
  const product = await tx.product.findUnique({
    where: { id: input.productId },
    select: {
      skuCategoryCode: true,
      skuModelNumber: true,
      category: { select: { name: true, slug: true, code: true } },
    },
  })
  if (!product) throw new BadRequestException('Product not found')

  if (product.skuCategoryCode && product.skuModelNumber) {
    return { categoryCode: product.skuCategoryCode, modelNumber: product.skuModelNumber }
  }

  const label =
    input.categoryLabel?.trim() ||
    [product.category?.name, product.category?.slug].filter(Boolean).join(' ') ||
    ''
  const identity = await allocateProductIdentity(tx, {
    storeId: input.storeId,
    categoryLabel: label,
    categoryCodeOverride: product.category?.code ?? null,
  })

  await tx.product.update({
    where: { id: input.productId },
    data: {
      skuCategoryCode: identity.categoryCode,
      skuModelNumber: identity.modelNumber,
    },
  })

  return identity
}

/**
 * Colour serials already issued on a product, plus a number for each colour
 * that does not have one yet.
 *
 * Serials are read from the stored `colorSerial` column, never re-derived from
 * the SKU: a colour keeps its number for the product's life, so renaming
 * "Silver" to "Metallic Silver" cannot renumber a variant whose SKU is printed
 * on a label and sitting in an order.
 *
 * Shared by the admin panel and the CSV importer so there is exactly one rule.
 */
export async function resolveColourSerials(
  tx: Prisma.TransactionClient,
  productId: string | null,
  colours: (string | null)[],
): Promise<Map<string, number>> {
  const key = (colour: string | null) => (colour ?? '').trim().toLowerCase() || '\u2014'
  const serials = new Map<string, number>()
  let highest = 0

  if (productId) {
    const existing = await tx.productVariant.findMany({
      where: { productId },
      select: { colorSerial: true, colorName: true, color: true },
    })
    for (const variant of existing) {
      const serial = variant.colorSerial
      if (!serial || serial <= 0) continue
      serials.set(key(variant.colorName ?? variant.color), serial)
      highest = Math.max(highest, serial)
    }
  }

  for (const colour of colours) {
    const k = key(colour)
    if (serials.has(k)) continue
    highest += 1
    serials.set(k, highest)
  }
  return serials
}

/** True when this identity was issued under the numeric Category Code scheme. */
export function usesNumericIdentity(identity: ProductSkuIdentity): boolean {
  return isValidCategoryCode(identity.categoryCode)
}

/**
 * The final codes for one variant: {category}-{style}-{colour}-{size} and the
 * matching 13-digit internal barcode.
 *
 * Legacy products — created before category codes existed — keep the old
 * SPL-{CAT}-{MODEL} SKU and a counter-issued barcode, because those labels are
 * already printed. `legacyBarcode` supplies that counter value.
 */
export function buildIdentityCodes(
  identity: ProductSkuIdentity,
  input: { size?: string | null; colourSerial: number; colorName?: string | null; color?: string | null },
  legacyBarcode?: string | null,
): { sku: string; barcode: string | null; colorSerial: number | null } {
  if (!usesNumericIdentity(identity)) {
    return {
      sku: buildSkuForVariant(identity, input),
      barcode: legacyBarcode ?? null,
      colorSerial: null,
    }
  }
  const parts = {
    categoryCode: identity.categoryCode,
    styleSerial: identity.modelNumber,
    colourSerial: input.colourSerial,
    size: input.size ?? null,
  }
  return {
    sku: buildVariantIdentitySku(parts),
    barcode: buildVariantIdentityBarcode(parts),
    colorSerial: input.colourSerial,
  }
}

/** Canonical SKU for one variant of a product with this identity. */
export function buildSkuForVariant(
  identity: ProductSkuIdentity,
  variant: VariantSkuInput,
): string {
  return buildVariantSku({
    category: identity.categoryCode,
    model: identity.modelNumber,
    color: colorLabel(variant),
    size: variant.size ?? null,
  })
}

async function skuTaken(
  tx: Prisma.TransactionClient,
  sku: string,
  ignoreVariantId?: string,
): Promise<boolean> {
  const existing = await tx.productVariant.findUnique({ where: { sku }, select: { id: true } })
  return Boolean(existing && existing.id !== ignoreVariantId)
}

/**
 * Generated SKUs are deterministic, so two variants of the same product with
 * the same colour+size collide by design — that combination is rejected
 * earlier. A collision here means a *different* product already owns the code
 * (e.g. an imported legacy SKU), so disambiguate rather than fail the save.
 */
export async function uniqueGeneratedSku(
  tx: Prisma.TransactionClient,
  base: string,
  ignoreVariantId?: string,
): Promise<string> {
  if (!(await skuTaken(tx, base, ignoreVariantId))) return base
  for (let suffix = 2; suffix <= 99; suffix++) {
    const candidate = `${base}-${suffix}`
    if (!(await skuTaken(tx, candidate, ignoreVariantId))) return candidate
  }
  throw new BadRequestException(`Could not allocate a unique SKU from ${base}`)
}


/**
 * Builds and validates variant SKUs.
 *
 * The client sends a preview; this service rebuilds the value from the stored
 * product identity so a tampered or stale preview can never become the saved
 * SKU. Format lives in `@splaro/config` and is shared with the admin panel.
 */
@Injectable()
export class VariantSkuService {
  constructor(private readonly prisma: PrismaService) {}

  async allocateIdentity(
    tx: Prisma.TransactionClient,
    input: { storeId: string; categoryLabel?: string | null; categoryCodeOverride?: string | null },
  ): Promise<ProductSkuIdentity> {
    return allocateProductIdentity(tx, input)
  }

  async ensureProductIdentity(
    tx: Prisma.TransactionClient,
    input: { productId: string; storeId: string; categoryLabel?: string | null },
  ): Promise<ProductSkuIdentity> {
    return ensureProductSkuIdentity(tx, input)
  }

  build(identity: ProductSkuIdentity, variant: VariantSkuInput): string {
    return buildSkuForVariant(identity, variant)
  }

  /**
   * Normalize an operator-supplied SKU. Returns null for blank input so the
   * caller falls back to generation.
   */
  normalizeManual(value: string | null | undefined): string | null {
    const raw = value?.trim()
    if (!raw) return null
    const normalized = normalizeSku(raw)
    if (!isValidSku(normalized)) {
      throw new BadRequestException({
        message: 'SKU must be 3–80 characters, letters, numbers and hyphens only',
        fieldErrors: { sku: 'Use letters, numbers and hyphens only (3–80 characters).' },
      })
    }
    return normalized
  }

  /** True when another variant already owns this SKU. */
  async isTaken(
    tx: Prisma.TransactionClient,
    sku: string,
    ignoreVariantId?: string,
  ): Promise<boolean> {
    const existing = await tx.productVariant.findUnique({
      where: { sku },
      select: { id: true },
    })
    return Boolean(existing && existing.id !== ignoreVariantId)
  }

  async assertAvailable(
    tx: Prisma.TransactionClient,
    sku: string,
    ignoreVariantId?: string,
  ): Promise<void> {
    if (await this.isTaken(tx, sku, ignoreVariantId)) {
      throw new BadRequestException({
        message: `SKU ${sku} is already used by another variant`,
        fieldErrors: { sku: `${sku} is already in use.` },
      })
    }
  }

  async uniqueGenerated(
    tx: Prisma.TransactionClient,
    base: string,
    ignoreVariantId?: string,
  ): Promise<string> {
    return uniqueGeneratedSku(tx, base, ignoreVariantId)
  }

  /** Report-only helper: variants missing a code, and duplicate codes in use. */
  async audit(storeId: string) {
    const variants = await this.prisma.productVariant.findMany({
      where: { product: { storeId } },
      select: {
        id: true,
        sku: true,
        barcode: true,
        size: true,
        colorName: true,
        product: { select: { id: true, name: true, slug: true } },
      },
    })

    const bySku = new Map<string, string[]>()
    const byBarcode = new Map<string, string[]>()
    for (const variant of variants) {
      if (variant.sku) bySku.set(variant.sku, [...(bySku.get(variant.sku) ?? []), variant.id])
      if (variant.barcode) {
        byBarcode.set(variant.barcode, [...(byBarcode.get(variant.barcode) ?? []), variant.id])
      }
    }

    return {
      total: variants.length,
      missingSku: variants.filter((v) => !v.sku?.trim()).length,
      missingBarcode: variants.filter((v) => !v.barcode?.trim()).length,
      duplicateSkus: [...bySku.entries()]
        .filter(([, ids]) => ids.length > 1)
        .map(([sku, ids]) => ({ sku, variantIds: ids })),
      duplicateBarcodes: [...byBarcode.entries()]
        .filter(([, ids]) => ids.length > 1)
        .map(([barcode, ids]) => ({ barcode, variantIds: ids })),
    }
  }
}
