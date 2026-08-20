import { BadRequestException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { toStoredMediaUrl, displaySizeLabel, normalizeStoredSize } from '@splaro/config'
import { productHexOrDefault } from '../../common/color-hex.util'
import type { PrismaService } from '../../common/prisma.service'
import { slugify } from '../../common/store.util'
import { reserveBarcodes } from './barcode-sequence.service'
import { ensureProductCode, issueProductCode } from './product-code.service'
import {
  buildIdentityCodes,
  resolveColourSerials,
  usesNumericIdentity,
  allocateProductIdentity,
  buildSkuForVariant,
  ensureProductSkuIdentity,
  uniqueGeneratedSku,
} from './variant-sku.service'
import { pickCategoryMatch, type CategoryLite } from './product-bulk-category.util'

export const CATALOG_BULK_MAX_ROWS = 200
const MAX_IMAGES = 10

export type CollectionNameCache = Map<string, string | null>

export interface CatalogBulkRowInput {
  name?: string
  nameBn?: string
  productSku: string
  slug?: string
  category?: string
  categorySlug?: string
  collection?: string
  description?: string
  descriptionBn?: string
  shortDescription?: string
  basePrice?: number
  compareAtPrice?: number | null
  costPrice?: number
  published?: boolean
  featured?: boolean
  newArrival?: boolean
  bestSeller?: boolean
  badge?: string
  rmCode?: string
  tags?: string[]
  fabric?: string
  fit?: string
  occasion?: string
  season?: string
  care?: string
  /** Primary image (legacy column). */
  imageUrl?: string
  /** Extra gallery URLs — pipe or comma separated. */
  imageUrls?: string[]
  size?: string
  color?: string
  colorHex?: string
  variantSku?: string
  barcode?: string
  price?: number
  stock?: number
}

export interface CatalogExportRow {
  name: string
  name_bn: string
  product_sku: string
  slug: string
  category: string
  category_slug: string
  collection: string
  description: string
  description_bn: string
  short_description: string
  base_price: string
  compare_at_price: string
  cost_price: string
  published: string
  featured: string
  new_arrival: string
  best_seller: string
  badge: string
  rm_code: string
  tags: string
  fabric: string
  fit: string
  occasion: string
  season: string
  care: string
  image_url: string
  image_urls: string
  size: string
  color: string
  color_hex: string
  variant_sku: string
  barcode: string
  price: string
  stock: string
}

function cell(value: string | number | null | undefined | { toString(): string }): string {
  if (value === null || value === undefined) return ''
  return String(value)
}

function readSchemaString(markup: unknown, key: string): string {
  if (!markup || typeof markup !== 'object' || Array.isArray(markup)) return ''
  const value = (markup as Record<string, unknown>)[key]
  return typeof value === 'string' ? value : ''
}

function mergeSchemaMarkup(
  existing: unknown,
  extras: { nameBn?: string; descriptionBn?: string },
): Prisma.InputJsonValue | undefined {
  const base =
    existing && typeof existing === 'object' && !Array.isArray(existing)
      ? { ...(existing as Record<string, string>) }
      : {}
  if (extras.nameBn !== undefined) {
    if (extras.nameBn.trim()) base.nameBn = extras.nameBn.trim()
    else delete base.nameBn
  }
  if (extras.descriptionBn !== undefined) {
    if (extras.descriptionBn.trim()) base.descriptionBn = extras.descriptionBn.trim()
    else delete base.descriptionBn
  }
  return Object.keys(base).length ? (base as Prisma.InputJsonValue) : undefined
}

function normalizeImageList(row: CatalogBulkRowInput): string[] {
  const urls: string[] = []
  const push = (raw?: string) => {
    const stored = toStoredMediaUrl(raw)
    if (stored && !urls.includes(stored)) urls.push(stored)
  }
  push(row.imageUrl)
  for (const u of row.imageUrls ?? []) push(u)
  return urls.slice(0, MAX_IMAGES)
}

function resolveCategoryId(
  categories: CategoryLite[],
  row: Pick<CatalogBulkRowInput, 'category' | 'categorySlug'>,
): string | null {
  const picked = pickCategoryMatch(categories, {
    ...(row.categorySlug?.trim() ? { slug: row.categorySlug } : {}),
    ...(row.category?.trim() ? { label: row.category } : {}),
  })
  if (!picked) return null
  if ('error' in picked) {
    throw new BadRequestException(picked.error)
  }
  return picked.id
}

async function resolveCollectionIdByName(
  prisma: PrismaService,
  storeId: string,
  collectionName: string | undefined,
  cache?: CollectionNameCache,
): Promise<string | null> {
  const name = collectionName?.trim()
  if (!name) return null
  const cacheKey = name.toLowerCase()
  if (cache?.has(cacheKey)) return cache.get(cacheKey) ?? null

  const found = await prisma.collection.findFirst({
    where: {
      storeId,
      OR: [
        { name: { equals: name, mode: 'insensitive' } },
        { slug: { equals: name.toLowerCase().replace(/\s+/g, '-'), mode: 'insensitive' } },
      ],
    },
    select: { id: true },
  })
  const id = found?.id ?? null
  cache?.set(cacheKey, id)
  return id
}

function buildProductSku(name: string, explicit?: string): string {
  const trimmed = explicit?.trim()
  if (trimmed) return trimmed.slice(0, 80)
  const slug = slugify(name)
  return `SPL-${slug
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')}`.slice(0, 48)
}

function errorMessage(err: unknown): string {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    return 'SKU or slug already exists on another product — use a unique product_sku / variant_sku'
  }
  if (err instanceof BadRequestException) {
    const body = err.getResponse()
    if (typeof body === 'string') return body
    if (body && typeof body === 'object' && 'message' in body) {
      const m = (body as { message?: string | string[] }).message
      return Array.isArray(m) ? m.join(', ') : m || 'Upsert failed'
    }
    return 'Upsert failed'
  }
  return err instanceof Error ? err.message : 'Upsert failed'
}

export async function loadCatalogExportRows(
  prisma: PrismaService,
  storeId: string,
  status?: string,
  createdAt?: Prisma.DateTimeFilter,
): Promise<CatalogExportRow[]> {
  const where: Prisma.ProductWhereInput = {
    storeId,
    ...(status === 'published'
      ? { isPublished: true }
      : status === 'draft'
        ? { isPublished: false }
        : {}),
    ...(createdAt ? { createdAt } : {}),
  }

  const rows: CatalogExportRow[] = []
  const pageSize = 100
  let skip = 0

  for (;;) {
    const products = await prisma.product.findMany({
      where,
      include: {
        category: { select: { name: true, slug: true } },
        collections: {
          take: 1,
          include: { collection: { select: { name: true } } },
        },
        images: {
          where: { NOT: { altText: 'media:video' } },
          orderBy: { position: 'asc' },
          take: MAX_IMAGES,
        },
        variants: {
          orderBy: { createdAt: 'asc' },
          select: {
            sku: true,
            barcode: true,
            size: true,
            color: true,
            colorName: true,
            colorHex: true,
            price: true,
            stock: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    })

    if (products.length === 0) break

    for (const p of products) {
      const imageUrls = p.images.map((img) => img.url).filter(Boolean)
      const variants = p.variants.length
        ? p.variants
        : [
            {
              sku: p.sku,
              barcode: p.barcode,
              size: null,
              color: null,
              colorName: null,
              colorHex: null,
              price: p.basePrice,
              stock: 0,
            },
          ]

      for (const v of variants) {
        rows.push({
          name: p.name,
          name_bn: readSchemaString(p.schemaMarkup, 'nameBn'),
          product_sku: cell(p.sku),
          slug: cell(p.slug),
          category: cell(p.category?.name),
          category_slug: cell(p.category?.slug),
          collection: cell(p.collections[0]?.collection?.name),
          description: cell(p.description),
          description_bn: readSchemaString(p.schemaMarkup, 'descriptionBn'),
          short_description: cell(p.shortDescription),
          base_price: cell(p.basePrice),
          compare_at_price: cell(p.compareAtPrice),
          cost_price: cell(p.costPrice),
          published: p.isPublished ? 'true' : 'false',
          featured: p.isFeatured ? 'true' : 'false',
          new_arrival: p.isNewArrival ? 'true' : 'false',
          best_seller: p.isBestSeller ? 'true' : 'false',
          badge: cell(p.badge),
          rm_code: cell(p.rmCode),
          tags: (p.tags ?? []).join(','),
          fabric: cell(p.fabricContent),
          fit: cell(p.fitType),
          occasion: cell(p.occasion),
          season: cell(p.season),
          care: cell(p.careInstructions),
          image_url: cell(imageUrls[0]),
          image_urls: imageUrls.slice(1).join(' | '),
          size: cell(displaySizeLabel(v.size)),
          color: cell(v.colorName ?? v.color),
          color_hex: cell(v.colorHex),
          variant_sku: cell(v.sku),
          barcode: cell(v.barcode),
          price: cell(v.price ?? p.basePrice),
          stock: cell(v.stock),
        })
      }
    }

    skip += products.length
    if (products.length < pageSize) break
  }

  return rows
}

export type CatalogBulkResult = {
  key: string
  ok: boolean
  action?: 'created' | 'updated'
  productId?: string
  error?: string
}

/**
 * Process rows grouped by product_sku inside one transaction per product so
 * multi-variant imports do not leave half-written products on mid-fail.
 */
export async function upsertCatalogRowsBatch(
  prisma: PrismaService,
  storeId: string,
  rows: CatalogBulkRowInput[],
): Promise<CatalogBulkResult[]> {
  const categories = await prisma.category.findMany({
    where: { storeId, isActive: true },
    select: { id: true, name: true, slug: true },
  })
  const collectionCache: CollectionNameCache = new Map()
  const results: CatalogBulkResult[] = new Array(rows.length)

  const groups = new Map<string, number[]>()
  rows.forEach((row, index) => {
    const key = (row.productSku?.trim() || row.variantSku?.trim() || `__row_${index}`).toLowerCase()
    const list = groups.get(key) ?? []
    list.push(index)
    groups.set(key, list)
  })

  for (const indexes of groups.values()) {
    try {
      await prisma.$transaction(async (tx) => {
        for (const index of indexes) {
          const row = rows[index]!
          const result = await upsertCatalogRow(
            tx as unknown as PrismaService,
            storeId,
            row,
            categories,
            collectionCache,
          )
          results[index] = result
          if (!result.ok) {
            throw new BadRequestException(result.error || 'Row failed')
          }
        }
      })
    } catch (err) {
      const message = errorMessage(err)
      for (const index of indexes) {
        if (!results[index] || results[index]!.ok) {
          results[index] = {
            key:
              rows[index]?.variantSku?.trim() ||
              rows[index]?.productSku?.trim() ||
              rows[index]?.name ||
              'unknown',
            ok: false,
            error: message,
          }
        }
      }
    }
  }

  return results.map(
    (r, i) =>
      r ?? {
        key: rows[i]?.productSku || 'unknown',
        ok: false,
        error: 'Upsert failed',
      },
  )
}

async function syncProductImages(
  prisma: PrismaService,
  productId: string,
  productName: string,
  urls: string[],
) {
  if (urls.length === 0) return
  await prisma.productImage.deleteMany({
    where: { productId, NOT: { altText: 'media:video' } },
  })
  await prisma.productImage.createMany({
    data: urls.map((url, position) => ({
      productId,
      url,
      altText: productName,
      isDefault: position === 0,
      position,
    })),
  })
}

async function linkCollection(
  prisma: PrismaService,
  productId: string,
  collectionId: string | null,
) {
  if (!collectionId) return
  await prisma.collectionProduct.deleteMany({ where: { productId } })
  await prisma.collectionProduct.create({
    data: { collectionId, productId },
  })
}

/**
 * Upsert one catalog spreadsheet row (one variant). Prefer upsertCatalogRowsBatch
 * so same-product rows share a transaction.
 */
export async function upsertCatalogRow(
  prisma: PrismaService,
  storeId: string,
  row: CatalogBulkRowInput,
  categories: CategoryLite[] = [],
  collectionCache?: CollectionNameCache,
): Promise<CatalogBulkResult> {
  const key = row.variantSku?.trim() || row.productSku?.trim() || row.name || 'unknown'
  try {
    if (!row.productSku?.trim() && !row.variantSku?.trim()) {
      throw new BadRequestException('productSku or variantSku required')
    }

    const productSkuHint = row.productSku?.trim()
    const variantSku = row.variantSku?.trim()

    let existingVariant = variantSku
      ? await prisma.productVariant.findFirst({
          where: { sku: variantSku, product: { storeId } },
          include: { product: true },
        })
      : null

    let product =
      existingVariant?.product ??
      (productSkuHint
        ? await prisma.product.findFirst({
            where: { storeId, sku: productSkuHint },
          })
        : null)

    if (!existingVariant && product && (row.size || row.color)) {
      const colorNeedle = row.color?.trim() || 'Default'
      existingVariant = await prisma.productVariant.findFirst({
        where: {
          productId: product.id,
          ...(row.size?.trim() ? { size: normalizeStoredSize(row.size) } : {}),
          OR: [
            { colorName: { equals: colorNeedle, mode: 'insensitive' } },
            { color: { equals: colorNeedle, mode: 'insensitive' } },
          ],
        },
        include: { product: true },
      })
      if (existingVariant) product = existingVariant.product
    }

    const categoryId = resolveCategoryId(categories, row)
    if ((row.category?.trim() || row.categorySlug?.trim()) && !categoryId) {
      throw new BadRequestException(
        `Category not found: ${(row.categorySlug || row.category || '').trim()}`,
      )
    }

    const collectionId = await resolveCollectionIdByName(
      prisma,
      storeId,
      row.collection,
      collectionCache,
    )
    if (row.collection?.trim() && !collectionId) {
      throw new BadRequestException(`Collection not found: ${row.collection.trim()}`)
    }

    const imageUrls = normalizeImageList(row)
    const primaryImage = imageUrls[0]
    const colorName = row.color?.trim() || 'Default'
    const colorHex = productHexOrDefault(row.colorHex)
    const size = normalizeStoredSize(row.size)
    const price =
      row.price !== undefined
        ? row.price
        : row.basePrice !== undefined
          ? row.basePrice
          : undefined
    const stock = row.stock !== undefined ? Math.max(0, Math.min(9999, row.stock)) : undefined

    if (product) {
      const wantPublish = row.published === true
      const resolvedCategoryId = categoryId ?? product.categoryId
      const effectivePrice = price ?? Number(product.basePrice)
      const canPublish = Boolean(resolvedCategoryId) && effectivePrice > 0
      const schemaMarkup = mergeSchemaMarkup(product.schemaMarkup, {
        ...(row.nameBn !== undefined ? { nameBn: row.nameBn } : {}),
        ...(row.descriptionBn !== undefined ? { descriptionBn: row.descriptionBn } : {}),
      })

      await prisma.product.update({
        where: { id: product.id },
        data: {
          ...(row.name?.trim() ? { name: row.name.trim() } : {}),
          ...(row.slug?.trim() ? { slug: slugify(row.slug.trim()) } : {}),
          ...(row.description !== undefined ? { description: row.description } : {}),
          ...(row.shortDescription !== undefined
            ? { shortDescription: row.shortDescription }
            : {}),
          ...(row.basePrice !== undefined ? { basePrice: row.basePrice } : {}),
          ...(row.compareAtPrice !== undefined ? { compareAtPrice: row.compareAtPrice } : {}),
          ...(row.costPrice !== undefined ? { costPrice: row.costPrice } : {}),
          ...(categoryId ? { categoryId } : {}),
          ...(row.tags ? { tags: row.tags } : {}),
          ...(row.fabric !== undefined ? { fabricContent: row.fabric } : {}),
          ...(row.fit !== undefined ? { fitType: row.fit } : {}),
          ...(row.occasion !== undefined ? { occasion: row.occasion } : {}),
          ...(row.season !== undefined ? { season: row.season } : {}),
          ...(row.care !== undefined ? { careInstructions: row.care } : {}),
          ...(row.featured !== undefined ? { isFeatured: row.featured } : {}),
          ...(row.newArrival !== undefined ? { isNewArrival: row.newArrival } : {}),
          ...(row.bestSeller !== undefined ? { isBestSeller: row.bestSeller } : {}),
          ...(row.badge !== undefined ? { badge: row.badge || null } : {}),
          ...(row.rmCode !== undefined ? { rmCode: row.rmCode || null } : {}),
          ...(schemaMarkup !== undefined ? { schemaMarkup } : {}),
          ...(row.published !== undefined
            ? {
                isPublished: wantPublish && canPublish,
                status:
                  wantPublish && canPublish
                    ? 'PUBLISHED'
                    : product.status === 'PUBLISHED' && !wantPublish
                      ? 'DRAFT'
                      : product.status,
              }
            : {}),
          ...(productSkuHint ? { sku: productSkuHint } : {}),
        },
      })

      if (imageUrls.length) {
        await syncProductImages(prisma, product.id, row.name?.trim() || product.name, imageUrls)
      }
      await linkCollection(prisma, product.id, collectionId)

      if (existingVariant) {
        const stockBefore = existingVariant.stock
        await prisma.productVariant.update({
          where: { id: existingVariant.id },
          data: {
            ...(size !== null ? { size } : {}),
            ...(row.color !== undefined ? { color: colorName, colorName, colorHex } : {}),
            ...(variantSku ? { sku: variantSku } : {}),
            ...(row.barcode !== undefined ? { barcode: row.barcode || null } : {}),
            ...(price !== undefined ? { price } : {}),
            ...(row.compareAtPrice !== undefined ? { compareAtPrice: row.compareAtPrice } : {}),
            ...(stock !== undefined ? { stock } : {}),
            ...(primaryImage ? { image: primaryImage } : {}),
          },
        })

        if (stock !== undefined && stock !== stockBefore) {
          await prisma.inventoryLog.create({
            data: {
              productId: product.id,
              variantId: existingVariant.id,
              action: 'ADJUSTMENT',
              quantity: stock - stockBefore,
              stockBefore,
              stockAfter: stock,
              note: 'Bulk catalog import',
            },
          })
        }

        const defaultVariant = await prisma.productVariant.findFirst({
          where: { productId: product.id },
          orderBy: { createdAt: 'asc' },
          select: { id: true },
        })
        if (defaultVariant?.id === existingVariant.id && price !== undefined) {
          await prisma.product.update({
            where: { id: product.id },
            data: {
              basePrice: price,
              ...(row.compareAtPrice !== undefined ? { compareAtPrice: row.compareAtPrice } : {}),
            },
          })
        }
      } else {
        if (price === undefined) {
          throw new BadRequestException('price required to add a new variant')
        }
        // Same canonical service the admin panel uses — one SKU format and one
        // barcode counter, whether a variant arrives by form or by CSV.
        const identity = await ensureProductSkuIdentity(prisma, {
          productId: product.id,
          storeId,
        })
        // A product imported before Product Codes existed gets one now, and the
        // colour keeps whatever serial it already holds on this product.
        await ensureProductCode(prisma, { productId: product.id, storeId })
        const serials = await resolveColourSerials(prisma, product.id, [colorName])
        const serial = serials.get((colorName ?? '').trim().toLowerCase() || '\u2014') ?? 1
        const addedCodes = buildIdentityCodes(
          identity,
          { size, colorName, colourSerial: serial },
          usesNumericIdentity(identity) ? null : ((await reserveBarcodes(prisma, 1))[0] ?? null),
        )
        const generatedSku = await uniqueGeneratedSku(prisma, variantSku || addedCodes.sku)
        const importedBarcode = row.barcode?.trim()
        const mintedBarcode = importedBarcode || addedCodes.barcode
        const createdVariant = await prisma.productVariant.create({
          data: {
            productId: product.id,
            size,
            color: colorName,
            colorName,
            colorHex,
            sku: generatedSku,
            barcode: mintedBarcode ?? null,
            colorSerial: addedCodes.colorSerial,
            price,
            compareAtPrice: row.compareAtPrice ?? null,
            stock: stock ?? 0,
            image: primaryImage || null,
            isActive: true,
          },
        })
        if (stock !== undefined && stock > 0) {
          await prisma.inventoryLog.create({
            data: {
              productId: product.id,
              variantId: createdVariant.id,
              action: 'ADJUSTMENT',
              quantity: stock,
              stockBefore: 0,
              stockAfter: stock,
              note: 'Bulk catalog import (new variant)',
            },
          })
        }
      }

      return { key, ok: true, action: 'updated', productId: product.id }
    }

    const name = row.name?.trim()
    if (!name) throw new BadRequestException('name required to create a product')
    const basePrice = row.basePrice ?? price
    if (basePrice === undefined || basePrice < 0) {
      throw new BadRequestException('base_price or price required to create')
    }

    const productSku = buildProductSku(name, productSkuHint)
    let slug = slugify(row.slug?.trim() || name)
    const clash = await prisma.product.findFirst({ where: { storeId, slug } })
    if (clash) slug = `${slug}-${Date.now().toString(36)}`

    const wantPublish = row.published === true
    const canPublish = Boolean(categoryId) && basePrice > 0
    // Same canonical identity the admin panel allocates — the importer must not
    // become a second code path. Category Code and style serial first, then the
    // customer-facing Product Code, then the variant's own codes.
    const importCategory = categoryId
      ? await prisma.category.findUnique({
          where: { id: categoryId },
          select: { code: true, name: true, slug: true },
        })
      : null
    const identity = await allocateProductIdentity(prisma, {
      storeId,
      categoryLabel: row.category?.trim() ?? '',
      categoryCodeOverride: importCategory?.code ?? null,
    })
    const importedProductCode = await issueProductCode(prisma, { storeId })
    const importedCodes = buildIdentityCodes(
      identity,
      { size, colorName, colourSerial: 1 },
      usesNumericIdentity(identity) ? null : ((await reserveBarcodes(prisma, 1))[0] ?? null),
    )
    const variantSkuFinal = await uniqueGeneratedSku(prisma, variantSku || importedCodes.sku)
    const importedBarcode = row.barcode?.trim()
    const newVariantBarcode = importedBarcode || importedCodes.barcode
    const schemaMarkup = mergeSchemaMarkup(null, {
      ...(row.nameBn !== undefined ? { nameBn: row.nameBn } : {}),
      ...(row.descriptionBn !== undefined ? { descriptionBn: row.descriptionBn } : {}),
    })

    const created = await prisma.product.create({
      data: {
        storeId,
        name,
        slug,
        description: row.description,
        shortDescription: row.shortDescription,
        basePrice,
        compareAtPrice: row.compareAtPrice ?? null,
        isOnSale:
          row.compareAtPrice != null && Number(row.compareAtPrice) > Number(basePrice),
        costPrice: row.costPrice,
        sku: productSku,
        productCode: importedProductCode,
        skuCategoryCode: identity.categoryCode,
        skuModelNumber: identity.modelNumber,
        categoryId,
        tags: row.tags ?? [],
        fabricContent: row.fabric,
        fitType: row.fit,
        occasion: row.occasion,
        season: row.season,
        careInstructions: row.care,
        origin: 'Bangladesh',
        lowStockThreshold: 5,
        isPublished: wantPublish && canPublish,
        status: wantPublish && canPublish ? 'PUBLISHED' : 'DRAFT',
        isHidden: false,
        isFeatured: row.featured ?? false,
        isNewArrival: row.newArrival ?? false,
        isBestSeller: row.bestSeller ?? false,
        badge: row.badge?.trim() || null,
        rmCode: row.rmCode?.trim() || null,
        ...(schemaMarkup ? { schemaMarkup } : {}),
        images: imageUrls.length
          ? {
              create: imageUrls.map((url, position) => ({
                url,
                altText: name,
                isDefault: position === 0,
                position,
              })),
            }
          : undefined,
        variants: {
          create: [
            {
              size,
              color: colorName,
              colorName,
              colorHex,
              sku: variantSkuFinal,
              barcode: newVariantBarcode ?? null,
              colorSerial: importedCodes.colorSerial,
              price: price ?? basePrice,
              compareAtPrice: row.compareAtPrice ?? null,
              stock: stock ?? 0,
              image: primaryImage || null,
              isActive: true,
            },
          ],
        },
      },
    })

    await linkCollection(prisma, created.id, collectionId)

    return { key, ok: true, action: 'created', productId: created.id }
  } catch (err) {
    return {
      key,
      ok: false,
      error: errorMessage(err),
    }
  }
}
