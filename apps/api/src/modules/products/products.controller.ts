import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  NotFoundException,
  Optional,
  Inject,
  Req,
} from '@nestjs/common'
import type { Request } from 'express'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../common/prisma.service'
import { CacheService } from '../../common/cache.service'
import { ProductAdvancedService } from './product-advanced.service'
import { MediaService } from '../media/media.service'
import { SearchService } from '../search/search.service'
import { assertStoreBrandId } from '../../common/assert-store-brand'
import { assertStoreCategoryId } from '../../common/assert-store-category'
import { resolveStoreId, slugify } from '../../common/store.util'
import { resolveAdminPagination } from '../../common/admin-pagination.util'
import { fireAndForget } from '../../common/fire-and-forget'
import { normalizeProductHex, productHexOrDefault } from '../../common/color-hex.util'
import { revalidateStorefrontWeb } from '../../common/revalidate-web'
import { mergeStorefrontConfig } from '../settings/storefront-config'
import { CreateAdminProductDto, AdminProductPatchDto } from '../../common/dtos/admin-products.dto'
import type { AdminSessionPayload } from '../../common/auth/admin-session.util'
import { resolveCustomerFacingSiteUrl, toStoredMediaUrl } from '@splaro/config'
import {
  CATALOG_BULK_MAX_ROWS,
  loadCatalogExportRows,
  upsertCatalogRowsBatch,
  type CatalogBulkRowInput,
} from './product-bulk-catalog.util'

type AdminRequest = Request & { adminUser?: AdminSessionPayload }

const MAX_PRODUCT_IMAGES = 10
const MEDIA_VIDEO_ALT = 'media:video'
const MEDIA_IMAGE_ALT = 'media:image'

const VISIBILITY_ONLY_PATCH_KEYS = new Set([
  'isPublished',
  'isHidden',
  'status',
  'isFeatured',
  'isNewArrival',
  'isBestSeller',
  'skipVersionSnapshot',
])

function shouldSkipVersionSnapshot(body: AdminProductPatchDto): boolean {
  if (body.skipVersionSnapshot === true) return true
  const keys = Object.keys(body).filter(
    (key) => body[key as keyof AdminProductPatchDto] !== undefined,
  )
  return keys.length > 0 && keys.every((key) => VISIBILITY_ONLY_PATCH_KEYS.has(key))
}

function resolvePublishState(body: {
  isPublished?: boolean
  status?: string
  publishAt?: string | null
}): { isPublished: boolean; status: string; publishAt: Date | null } {
  const publishAtRaw = body.publishAt?.trim()
  const publishAt = publishAtRaw ? new Date(publishAtRaw) : null
  const publishAtValid = publishAt && !Number.isNaN(publishAt.getTime()) ? publishAt : null

  if (body.status === 'ARCHIVED') {
    return { isPublished: false, status: 'ARCHIVED', publishAt: null }
  }

  if (publishAtValid && publishAtValid.getTime() > Date.now()) {
    return { isPublished: false, status: 'SCHEDULED', publishAt: publishAtValid }
  }

  if (publishAtValid && publishAtValid.getTime() <= Date.now()) {
    return { isPublished: true, status: 'PUBLISHED', publishAt: publishAtValid }
  }

  if (body.status === 'SCHEDULED') {
    return { isPublished: false, status: 'SCHEDULED', publishAt: publishAtValid }
  }

  const isPublished =
    typeof body.isPublished === 'boolean' ? body.isPublished : body.status === 'PUBLISHED'

  return {
    isPublished,
    status: isPublished ? 'PUBLISHED' : 'DRAFT',
    publishAt: publishAtValid,
  }
}

function optionalTrimmed(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

/**
 * Product fields kept in `schemaMarkup` rather than their own columns —
 * Bangla copy and the weaving label. Adding a key here is all it takes to
 * make a new extra field round-trip through create, update and read.
 */
const SCHEMA_EXTRA_KEYS = ['nameBn', 'descriptionBn', 'weavingType'] as const
type SchemaExtraKey = (typeof SCHEMA_EXTRA_KEYS)[number]
type SchemaExtras = Partial<Record<SchemaExtraKey, string | undefined>>

function pickSchemaExtras(body: SchemaExtras): SchemaExtras {
  const picked: SchemaExtras = {}
  for (const key of SCHEMA_EXTRA_KEYS) {
    if (body[key] !== undefined) picked[key] = body[key]
  }
  return picked
}

function buildSchemaMarkup(extras: SchemaExtras): Record<string, string> {
  const out: Record<string, string> = {}
  for (const key of SCHEMA_EXTRA_KEYS) {
    const value = extras[key]?.trim()
    if (value) out[key] = value
  }
  return out
}

/** An explicitly cleared field is removed; an absent field is left untouched. */
function mergeSchemaMarkup(
  existing: unknown,
  extras: SchemaExtras,
): Record<string, string> | undefined {
  const base =
    existing && typeof existing === 'object' && !Array.isArray(existing)
      ? { ...(existing as Record<string, string>) }
      : {}
  for (const key of SCHEMA_EXTRA_KEYS) {
    const value = extras[key]
    if (value === undefined) continue
    if (value.trim()) base[key] = value.trim()
    else delete base[key]
  }
  return Object.keys(base).length ? base : undefined
}

@Controller('admin/products')
export class ProductsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly productAdvanced: ProductAdvancedService,
    @Inject(CacheService) private readonly cache: CacheService,
    @Optional() private readonly search?: SearchService,
    @Optional() private readonly media?: MediaService,
  ) {}

  private async bustProductCache(storeId: string): Promise<void> {
    await Promise.all([
      this.cache.invalidateStoreResource(storeId, 'products'),
      this.cache.invalidateStoreResource(storeId, 'product'),
    ])
    void revalidateStorefrontWeb(['storefront-products'])
  }

  /** Confirms a product exists and belongs to the caller's store — prevents cross-store IDOR via :id. */
  private async assertOwnedProduct(id: string, req: AdminRequest): Promise<void> {
    const product = await this.prisma.product.findUnique({ where: { id }, select: { storeId: true } })
    if (!product) throw new NotFoundException('Product not found')
    if (req.adminUser?.storeId && product.storeId !== req.adminUser.storeId) {
      throw new NotFoundException('Product not found')
    }
  }

  @Get()
  async list(
    @Query('storeId') storeId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const { page: pageNum, limit: take, skip } = resolveAdminPagination(page, limit)
    const where = {
      storeId: sid,
      ...(status === 'published' ? { isPublished: true } : status === 'draft' ? { isPublished: false } : {}),
      ...(search ? { name: { contains: search, mode: 'insensitive' as const } } : {}),
    }

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: {
          images: {
            where: { NOT: { altText: MEDIA_VIDEO_ALT } },
            orderBy: { position: 'asc' },
            take: 1,
          },
          category: { select: { id: true, name: true, slug: true } },
          variants: { select: { id: true, stock: true, reservedStock: true, sku: true, size: true, color: true, colorName: true, price: true } },
          _count: { select: { variants: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.product.count({ where }),
    ])

    return { products, total, page: pageNum, totalPages: Math.ceil(total / take) }
  }

  // ── Reviews (admin) — must be registered before :id routes ──

  @Get('reviews')
  async listReviews(
    @Query('storeId') storeId: string,
    @Query('status') status?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 50,
  ) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const { page: pageNum, limit: take, skip } = resolveAdminPagination(page, limit, 50)
    const where = {
      product: { storeId: sid },
      ...(status ? { status: status as never } : {}),
    }
    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        include: {
          product: { select: { id: true, name: true, slug: true } },
          customer: { select: { firstName: true, lastName: true, phone: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.review.count({ where }),
    ])
    return { reviews, total, page: pageNum, totalPages: Math.ceil(total / take) }
  }

  @Patch('reviews/:id')
  async updateReview(
    @Param('id') id: string,
    @Body() body: {
      status?: 'APPROVED' | 'REJECTED' | 'PENDING'
      adminReply?: string | null
    },
  ) {
    const data: {
      status?: 'APPROVED' | 'REJECTED' | 'PENDING'
      adminReply?: string | null
      adminReplyAt?: Date | null
    } = {}

    if (body.status) data.status = body.status
    if (body.adminReply !== undefined) {
      const reply = body.adminReply?.trim() || null
      data.adminReply = reply
      data.adminReplyAt = reply ? new Date() : null
    }

    const review = await this.prisma.review.update({ where: { id }, data })
    const product = await this.prisma.product.findUnique({
      where: { id: review.productId },
      select: { storeId: true },
    })
    if (body.status === 'APPROVED' || body.status === 'REJECTED') {
      const stats = await this.prisma.review.aggregate({
        where: { productId: review.productId, status: 'APPROVED' },
        _avg: { rating: true },
        _count: { id: true },
      })
      await this.prisma.product.update({
        where: { id: review.productId },
        data: {
          rating: Number((stats._avg.rating ?? 0).toFixed(2)),
          reviewCount: stats._count.id,
        },
      })
    }
    if (product) await this.bustProductCache(product.storeId)
    return review
  }

  @Delete('reviews/:id')
  async deleteReview(@Param('id') id: string) {
    const review = await this.prisma.review.delete({ where: { id } })
    const product = await this.prisma.product.findUnique({
      where: { id: review.productId },
      select: { storeId: true },
    })
    const stats = await this.prisma.review.aggregate({
      where: { productId: review.productId, status: 'APPROVED' },
      _avg: { rating: true },
      _count: { id: true },
    })
    await this.prisma.product.update({
      where: { id: review.productId },
      data: {
        rating: Number((stats._avg.rating ?? 0).toFixed(2)),
        reviewCount: stats._count.id,
      },
    })
    if (product) await this.bustProductCache(product.storeId)
    return { deleted: true }
  }

  @Post()
  async create(
    @Query('storeId') storeId: string,
    @Body() body: CreateAdminProductDto,
  ) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const publishState = resolvePublishState(body)
    const categoryId = await assertStoreCategoryId(this.prisma, sid, body.categoryId, {
      required: publishState.status !== 'DRAFT',
    })
    // Optional: most products have no brand. Store scope is still enforced.
    const brandId = await assertStoreBrandId(this.prisma, sid, body.brandId)
    let slug = slugify(body.slug?.trim() || body.name)
    const clash = await this.prisma.product.findFirst({ where: { storeId: sid, slug } })
    if (clash) slug = `${slug}-${Date.now().toString(36)}`

    const sizes = body.sizes?.length ? body.sizes : ['M', 'L']
    const variantStock = Math.max(0, Math.min(9999, Number(body.defaultStock) || 10))
    const legacyImageUrls = Array.from(new Set([body.imageUrl, ...(body.imageUrls ?? [])]
      .map((url) => toStoredMediaUrl(url))
      .filter(Boolean) as string[])).slice(0, MAX_PRODUCT_IMAGES)
    const requestedMedia = body.media?.length
      ? body.media
          .map((row, index) => ({
            url: toStoredMediaUrl(row.url),
            type: row.type,
            altText: row.altText?.trim(),
            isDefault: row.isDefault === true,
            position: row.position ?? index,
          }))
          .filter((row): row is typeof row & { url: string } => Boolean(row.url))
          .slice(0, MAX_PRODUCT_IMAGES + 1)
      : []
    const imageUrls = requestedMedia.length
      ? requestedMedia.filter((row) => row.type === 'image').map((row) => row.url).slice(0, MAX_PRODUCT_IMAGES)
      : legacyImageUrls
    const primaryImage = imageUrls[0]
    const videoUrl = toStoredMediaUrl(body.videoUrl) || undefined
    const mediaRows = requestedMedia.length
      ? requestedMedia.map((row, index) => ({
          url: row.url,
          altText: row.type === 'video' ? MEDIA_VIDEO_ALT : row.altText || body.name,
          isDefault: row.type === 'image' && (row.isDefault || (!requestedMedia.some((item) => item.isDefault) && index === 0)),
          position: row.type === 'video' ? -1 : row.position,
        }))
      : [
          ...(videoUrl ? [{ url: videoUrl, altText: MEDIA_VIDEO_ALT, isDefault: imageUrls.length === 0, position: -1 }] : []),
          ...imageUrls.map((url, index) => ({
            url,
            altText: body.name,
            isDefault: index === 0,
            position: index,
          })),
        ]
    type ColorDef = string | { name: string; hex: string; image?: string }
    const colorDefs: ColorDef[] = body.colors?.length ? body.colors : [{ name: 'Default', hex: '#111111' }]
    const normalizedColors = colorDefs.map((color, index) => {
      if (typeof color === 'string') {
        return {
          name: color,
          hex: productHexOrDefault(undefined),
          image: imageUrls[index] ?? primaryImage,
        }
      }
      return {
        name: color.name,
        hex: productHexOrDefault(color.hex),
        image: toStoredMediaUrl(color.image) || imageUrls[index] || primaryImage,
      }
    })

    const schemaExtras = buildSchemaMarkup(body)

    const productSku =
      body.sku?.trim() ||
      `SPL-${slug
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '-')
        .replace(/^-|-$/g, '')}`.slice(0, 48)

    const requestedVariants = body.variants?.map((variant) => ({
      size: optionalTrimmed(variant.size) ?? null,
      color: optionalTrimmed(variant.colorName) ?? 'Default',
      colorName: optionalTrimmed(variant.colorName) ?? 'Default',
      colorHex: productHexOrDefault(variant.colorHex),
      image: toStoredMediaUrl(variant.image) || primaryImage,
      sku: optionalTrimmed(variant.sku) ?? null,
      barcode: optionalTrimmed(variant.barcode) ?? null,
      price: variant.price,
      compareAtPrice: variant.compareAtPrice ?? null,
      stock: variant.stock,
      isActive: variant.isActive ?? true,
    })) ?? []

    const legacyVariants = sizes.flatMap((size) =>
      normalizedColors.map((color) => ({
        size,
        color: color.name,
        colorHex: color.hex,
        colorName: color.name,
        price: body.basePrice,
        compareAtPrice: body.compareAtPrice ?? null,
        stock: variantStock,
        image: color.image ?? primaryImage,
        isActive: true,
        ...(productSku
          ? { sku: `${productSku}-${size}-${color.name}`.replace(/\s+/g, '-').slice(0, 80) }
          : { sku: null }),
        barcode: null,
      })),
    )
    const variants = body.variants !== undefined ? requestedVariants : legacyVariants
    const combinationKeys = variants.map((variant) =>
      `${variant.size ?? ''}::${variant.colorName ?? ''}`.toLocaleLowerCase(),
    )
    if (new Set(combinationKeys).size !== combinationKeys.length) {
      throw new BadRequestException({
        message: 'Duplicate size and colour combinations are not allowed',
        fieldErrors: { variants: 'Each size and colour combination must be unique.' },
      })
    }
    const variantSkus = variants.map((variant) => variant.sku?.toLocaleLowerCase()).filter(Boolean)
    if (new Set(variantSkus).size !== variantSkus.length) {
      throw new BadRequestException({
        message: 'Duplicate variant SKUs are not allowed',
        fieldErrors: { variants: 'Each variant SKU must be unique.' },
      })
    }
    if (publishState.status !== 'DRAFT') {
      const fieldErrors: Record<string, string> = {}
      if (!categoryId) fieldErrors.categoryId = 'Category is required to publish.'
      if (!imageUrls.length) fieldErrors.media = 'Add at least one product image to publish.'
      if (!variants.some((variant) => variant.isActive && Number(variant.price) > 0)) {
        fieldErrors.variants = 'Add at least one active variant with a valid price.'
      }
      if (Object.keys(fieldErrors).length) {
        throw new BadRequestException({ message: 'Product is not ready to publish', fieldErrors })
      }
    }

    const product = await this.prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
        storeId: sid,
        name: body.name,
        slug,
        description: body.description,
        shortDescription: body.shortDescription,
        basePrice: body.basePrice,
        compareAtPrice: body.compareAtPrice,
        isOnSale: body.compareAtPrice != null && Number(body.compareAtPrice) > Number(body.basePrice),
        costPrice: body.costPrice,
        sku: productSku || undefined,
        rmCode: optionalTrimmed(body.rmCode) ?? undefined,
        barcode: optionalTrimmed(body.barcode) ?? undefined,
        qrCode: optionalTrimmed(body.qrCode) ?? undefined,
        weight: body.weight != null ? body.weight : undefined,
        lengthCm: body.lengthCm != null ? body.lengthCm : undefined,
        widthCm: body.widthCm != null ? body.widthCm : undefined,
        heightCm: body.heightCm != null ? body.heightCm : undefined,
        productType: optionalTrimmed(body.productType) ?? undefined,
        inventoryPolicy: body.inventoryPolicy ?? 'DENY',
        preorderReleaseAt: body.preorderReleaseAt ? new Date(body.preorderReleaseAt) : undefined,
        additionalDetails: body.additionalDetails?.length
          ? (body.additionalDetails as unknown as Prisma.InputJsonValue)
          : undefined,
        origin: optionalTrimmed(body.origin) ?? 'Bangladesh',
        badge: optionalTrimmed(body.badge) ?? undefined,
        lowStockThreshold: body.lowStockThreshold ?? 5,
        tags: body.tags ?? [],
        categoryId,
        brandId,
        isPublished: publishState.isPublished,
        isHidden: body.isHidden ?? false,
        status: publishState.status,
        publishAt: publishState.publishAt,
        fabricContent: body.fabricContent,
        fitType: body.fitType,
        occasion: body.occasion,
        season: body.season,
        careInstructions: body.careInstructions,
        metaTitle: body.metaTitle,
        metaDescription: body.metaDescription,
        isFeatured: body.isFeatured ?? false,
        isNewArrival: body.isNewArrival ?? false,
        isBestSeller: body.isBestSeller ?? false,
        ...(Object.keys(schemaExtras).length ? { schemaMarkup: schemaExtras } : {}),
        images: mediaRows.length
          ? { create: mediaRows }
          : undefined,
        variants: {
          create: variants,
        },
      },
      include: { images: true, variants: true, category: true },
      })
      if (body.collectionId) {
        const collection = await tx.collection.findFirst({
          where: { id: body.collectionId, storeId: sid },
          select: { id: true },
        })
        if (!collection) throw new BadRequestException('Collection does not belong to this store')
        await tx.collectionProduct.create({
          data: { collectionId: body.collectionId, productId: created.id },
        })
      }
      return created
    })

    if (this.search) fireAndForget(this.search.indexProducts(sid), 'search.indexProducts')
    await this.bustProductCache(sid)

    // Fill any missing variant SKUs from slug/product SKU (never cuid tails).
    await this.productAdvanced.ensureVariantSKUs(product.id)
    const refreshed = await this.prisma.product.findUnique({
      where: { id: product.id },
      include: { images: true, variants: true, category: true },
    })
    return refreshed ?? product
  }

  @Get('export')
  async exportCatalog(
    @Query('storeId') storeId: string,
    @Query('status') status?: string,
  ) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const rows = await loadCatalogExportRows(this.prisma, sid, status)
    return { rows, total: rows.length }
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Query('storeId') storeId: string) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const product = await this.prisma.product.findFirst({
      where: { id, storeId: sid },
      include: { images: true, variants: true, category: true, collections: true },
    })
    if (!product) throw new NotFoundException('Product not found')
    return product
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: AdminProductPatchDto, @Req() req: AdminRequest) {
    const existing = await this.prisma.product.findUnique({
      where: { id },
      select: { storeId: true, schemaMarkup: true, basePrice: true, compareAtPrice: true },
    })
    if (!existing) throw new NotFoundException('Product not found')
    if (req.adminUser?.storeId && existing.storeId !== req.adminUser.storeId) {
      throw new NotFoundException('Product not found')
    }

    const changedBy = req.adminUser?.email ?? req.adminUser?.name ?? 'admin'
    if (!shouldSkipVersionSnapshot(body)) {
      await this.productAdvanced.trySaveProductVersion(id, changedBy)
    }

    const publishPatch =
      body.isPublished !== undefined || body.status !== undefined || body.publishAt !== undefined
        ? resolvePublishState({
            isPublished: body.isPublished,
            status: body.status,
            publishAt: body.publishAt,
          })
        : null

    const schemaExtraUpdates = pickSchemaExtras(body)
    const schemaMarkup =
      Object.keys(schemaExtraUpdates).length > 0
        ? mergeSchemaMarkup(existing.schemaMarkup, schemaExtraUpdates)
        : undefined

    const imageUrls = Array.from(
      new Set(
        [body.imageUrl, ...(body.imageUrls ?? [])]
          .map((url) => toStoredMediaUrl(url))
          .filter(Boolean) as string[],
      ),
    ).slice(0, MAX_PRODUCT_IMAGES)
    const videoUrl = body.videoUrl !== undefined ? (toStoredMediaUrl(body.videoUrl) || undefined) : undefined
    const mediaUpdateRequested =
      body.imageUrls !== undefined || body.videoUrl !== undefined || body.imageUrl !== undefined

    const nextCategoryId =
      body.categoryId !== undefined
        ? await assertStoreCategoryId(this.prisma, existing.storeId, body.categoryId)
        : undefined

    // `null` clears the brand; omitting the key leaves it untouched.
    const nextBrandId =
      body.brandId !== undefined
        ? await assertStoreBrandId(this.prisma, existing.storeId, body.brandId)
        : undefined

    const product = await this.prisma.product.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.slug !== undefined ? { slug: slugify(body.slug) } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.shortDescription !== undefined ? { shortDescription: body.shortDescription } : {}),
        ...(body.basePrice !== undefined ? { basePrice: body.basePrice } : {}),
        ...(body.compareAtPrice !== undefined ? { compareAtPrice: body.compareAtPrice } : {}),
        ...(body.compareAtPrice !== undefined || body.basePrice !== undefined
          ? {
              isOnSale:
                Number(body.compareAtPrice ?? existing.compareAtPrice ?? 0) >
                Number(body.basePrice ?? existing.basePrice),
            }
          : {}),
        ...(body.costPrice !== undefined ? { costPrice: body.costPrice } : {}),
        ...(body.sku !== undefined ? { sku: body.sku.trim() || null } : {}),
        ...(body.lowStockThreshold !== undefined ? { lowStockThreshold: body.lowStockThreshold } : {}),
        ...(body.tags !== undefined ? { tags: body.tags } : {}),
        ...(schemaMarkup !== undefined ? { schemaMarkup } : {}),
        ...(nextCategoryId !== undefined ? { categoryId: nextCategoryId } : {}),
        ...(body.brandId !== undefined ? { brandId: nextBrandId } : {}),
        ...(publishPatch
          ? {
              isPublished: publishPatch.isPublished,
              status: publishPatch.status,
              publishAt: publishPatch.publishAt,
            }
          : {}),
        ...(body.weight !== undefined ? { weight: body.weight } : {}),
        ...(body.lengthCm !== undefined ? { lengthCm: body.lengthCm } : {}),
        ...(body.widthCm !== undefined ? { widthCm: body.widthCm } : {}),
        ...(body.heightCm !== undefined ? { heightCm: body.heightCm } : {}),
        ...(body.productType !== undefined ? { productType: optionalTrimmed(body.productType) } : {}),
        ...(body.inventoryPolicy !== undefined ? { inventoryPolicy: body.inventoryPolicy } : {}),
        ...(body.preorderReleaseAt !== undefined
          ? { preorderReleaseAt: body.preorderReleaseAt ? new Date(body.preorderReleaseAt) : null }
          : {}),
        ...(body.additionalDetails !== undefined
          ? { additionalDetails: body.additionalDetails as unknown as Prisma.InputJsonValue }
          : {}),
        ...(body.origin !== undefined ? { origin: optionalTrimmed(body.origin) } : {}),
        ...(body.badge !== undefined ? { badge: optionalTrimmed(body.badge) } : {}),
        ...(body.rmCode !== undefined ? { rmCode: optionalTrimmed(body.rmCode) } : {}),
        ...(body.barcode !== undefined ? { barcode: optionalTrimmed(body.barcode) } : {}),
        ...(body.qrCode !== undefined ? { qrCode: optionalTrimmed(body.qrCode) } : {}),
        ...(body.isHidden !== undefined ? { isHidden: body.isHidden } : {}),
        ...(body.fabricContent !== undefined ? { fabricContent: body.fabricContent } : {}),
        ...(body.fitType !== undefined ? { fitType: body.fitType } : {}),
        ...(body.occasion !== undefined ? { occasion: body.occasion } : {}),
        ...(body.careInstructions !== undefined ? { careInstructions: body.careInstructions } : {}),
        ...(body.season !== undefined ? { season: body.season } : {}),
        ...(body.metaTitle !== undefined ? { metaTitle: body.metaTitle } : {}),
        ...(body.metaDescription !== undefined ? { metaDescription: body.metaDescription } : {}),
        ...(body.isFeatured !== undefined ? { isFeatured: body.isFeatured } : {}),
        ...(body.isNewArrival !== undefined ? { isNewArrival: body.isNewArrival } : {}),
        ...(body.isBestSeller !== undefined ? { isBestSeller: body.isBestSeller } : {}),
      },
      include: { images: true, variants: true, category: true, collections: true },
    })

    if (body.collectionId !== undefined) {
      await this.prisma.collectionProduct.deleteMany({ where: { productId: id } })
      if (body.collectionId) {
        await this.prisma.collectionProduct.create({
          data: { collectionId: body.collectionId, productId: id },
        })
      }
    }

    if (body.basePrice !== undefined) {
      await this.prisma.productVariant.updateMany({
        where: { productId: id },
        data: { price: body.basePrice },
      })
    }

    if (mediaUpdateRequested) {
      await this.prisma.productImage.deleteMany({ where: { productId: id } })
      const mediaRows = [
        ...(videoUrl
          ? [{ url: videoUrl, altText: MEDIA_VIDEO_ALT, isDefault: imageUrls.length === 0, position: -1 }]
          : []),
        ...imageUrls.map((url, index) => ({
          url,
          altText: MEDIA_IMAGE_ALT,
          isDefault: index === 0,
          position: index,
        })),
      ]
      if (mediaRows.length) {
        await this.prisma.productImage.createMany({
          data: mediaRows.map((row) => ({
            productId: id,
            url: row.url,
            altText: row.altText,
            isDefault: row.isDefault,
            position: row.position,
          })),
        })
      }
    } else if (body.imageUrl) {
      await this.prisma.productImage.deleteMany({ where: { productId: id } })
      const stored = toStoredMediaUrl(body.imageUrl)
      if (stored) {
        await this.prisma.productImage.create({
          data: { productId: id, url: stored, isDefault: true, position: 0 },
        })
      }
    }

    if (this.search) fireAndForget(this.search.indexProducts(product.storeId), 'search.indexProducts')
    await this.bustProductCache(product.storeId)
    return this.prisma.product.findUnique({
      where: { id },
      include: { images: true, variants: true, category: true, collections: true },
    })
  }

  @Post(':id/variants')
  async createVariant(
    @Param('id') productId: string,
    @Body()
    body: {
      size?: string
      color?: string
      colorName?: string
      colorHex?: string
      image?: string
      sku?: string
      barcode?: string
      price: number
      compareAtPrice?: number
      stock?: number
    },
  ) {
    const product = await this.prisma.product.findUnique({ where: { id: productId }, select: { id: true, storeId: true } })
    if (!product) throw new NotFoundException('Product not found')

    if (body.price === undefined || body.price === null || Number(body.price) < 0) {
      throw new BadRequestException('Price is required and cannot be negative')
    }
    const stock = body.stock !== undefined ? Number(body.stock) : 0
    if (stock < 0) throw new BadRequestException('Stock cannot be negative')

    const size = body.size?.trim() || null
    const color = body.color?.trim() || null
    const comboClash = await this.prisma.productVariant.findFirst({
      where: { productId, size, color },
    })
    if (comboClash) {
      throw new BadRequestException(
        `A variant with size "${size ?? '—'}" and color "${color ?? '—'}" already exists on this product`,
      )
    }

    const sku = body.sku?.trim() || undefined
    if (sku) {
      const skuClash = await this.prisma.productVariant.findFirst({ where: { productId, sku } })
      if (skuClash) throw new BadRequestException(`SKU "${sku}" already used by another variant on this product`)
    }
    const barcode = body.barcode?.trim() || undefined
    if (barcode) {
      const barcodeClash = await this.prisma.productVariant.findFirst({ where: { productId, barcode } })
      if (barcodeClash) {
        throw new BadRequestException(`Barcode "${barcode}" already used by another variant on this product`)
      }
    }

    const variant = await this.prisma.productVariant.create({
      data: {
        productId,
        size,
        color,
        colorName: body.colorName?.trim() || color || null,
        colorHex: body.colorHex?.trim() ? productHexOrDefault(body.colorHex) : null,
        image: body.image?.trim() || null,
        sku: sku ?? null,
        barcode: barcode ?? null,
        price: body.price,
        compareAtPrice: body.compareAtPrice ?? null,
        stock,
      },
    })

    if (stock > 0) {
      await this.prisma.inventoryLog.create({
        data: {
          productId,
          variantId: variant.id,
          action: 'ADJUSTMENT',
          quantity: stock,
          stockBefore: 0,
          stockAfter: stock,
          note: 'Variant created',
        },
      })
    }

    if (this.search) fireAndForget(this.search.indexProducts(product.storeId), 'search.indexProducts')
    await this.bustProductCache(product.storeId)
    return variant
  }

  @Patch(':id/variants/:variantId')
  async updateVariant(
    @Param('id') productId: string,
    @Param('variantId') variantId: string,
    @Body()
    body: {
      stock?: number
      price?: number
      compareAtPrice?: number | null
      isActive?: boolean
      sku?: string
      barcode?: string
      size?: string
      color?: string
      colorName?: string
      colorHex?: string
      image?: string
      stockReason?: string
      stockNote?: string
    },
  ) {
    const product = await this.prisma.product.findUnique({ where: { id: productId }, select: { id: true, storeId: true } })
    if (!product) throw new NotFoundException('Product not found')

    const variant = await this.prisma.productVariant.findFirst({ where: { id: variantId, productId } })
    if (!variant) throw new NotFoundException('Variant not found')

    if (body.stock !== undefined && body.stock < 0) {
      throw new BadRequestException('Stock cannot be negative')
    }
    if (body.price !== undefined && body.price < 0) {
      throw new BadRequestException('Price cannot be negative')
    }

    const sku = body.sku !== undefined ? body.sku.trim() : undefined
    if (sku) {
      const clash = await this.prisma.productVariant.findFirst({
        where: { productId, sku, NOT: { id: variantId } },
      })
      if (clash) throw new BadRequestException(`SKU "${sku}" already used by another variant on this product`)
    }
    const barcode = body.barcode !== undefined ? body.barcode.trim() : undefined
    if (barcode) {
      const barcodeClash = await this.prisma.productVariant.findFirst({
        where: { productId, barcode, NOT: { id: variantId } },
      })
      if (barcodeClash) {
        throw new BadRequestException(`Barcode "${barcode}" already used by another variant on this product`)
      }
    }

    const nextSize = body.size !== undefined ? body.size.trim() || null : variant.size
    const nextColor = body.color !== undefined ? body.color.trim() || null : variant.color
    if (body.size !== undefined || body.color !== undefined) {
      const comboClash = await this.prisma.productVariant.findFirst({
        where: { productId, size: nextSize, color: nextColor, NOT: { id: variantId } },
      })
      if (comboClash) {
        throw new BadRequestException(
          `A variant with size "${nextSize ?? '—'}" and color "${nextColor ?? '—'}" already exists on this product`,
        )
      }
    }

    const updated = await this.prisma.productVariant.update({
      where: { id: variantId },
      data: {
        ...(body.stock !== undefined ? { stock: body.stock } : {}),
        ...(body.price !== undefined ? { price: body.price } : {}),
        ...(body.compareAtPrice !== undefined ? { compareAtPrice: body.compareAtPrice } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
        ...(body.sku !== undefined ? { sku: sku || null } : {}),
        ...(body.barcode !== undefined ? { barcode: barcode || null } : {}),
        ...(body.size !== undefined ? { size: nextSize } : {}),
        ...(body.color !== undefined ? { color: nextColor } : {}),
        ...(body.colorName !== undefined ? { colorName: body.colorName.trim() || null } : {}),
        ...(body.colorHex !== undefined
          ? { colorHex: body.colorHex.trim() ? normalizeProductHex(body.colorHex) : null }
          : {}),
        ...(body.image !== undefined ? { image: body.image.trim() || null } : {}),
      },
    })

    if (body.stock !== undefined) {
      const reason = body.stockReason?.trim() || 'Admin manual update'
      const detail = body.stockNote?.trim()
      const note = detail ? `${reason}: ${detail}` : reason
      await this.prisma.inventoryLog.create({
        data: {
          productId,
          variantId,
          action: 'ADJUSTMENT',
          quantity: body.stock - variant.stock,
          stockBefore: variant.stock,
          stockAfter: body.stock,
          note,
        },
      })
    }

    if (this.search) fireAndForget(this.search.indexProducts(product.storeId), 'search.indexProducts')
    await this.bustProductCache(product.storeId)
    return updated
  }

  @Patch(':id/variants/:variantId/archive')
  async archiveVariant(@Param('id') productId: string, @Param('variantId') variantId: string) {
    const product = await this.prisma.product.findUnique({ where: { id: productId }, select: { id: true, storeId: true } })
    if (!product) throw new NotFoundException('Product not found')

    const variant = await this.prisma.productVariant.findFirst({ where: { id: variantId, productId } })
    if (!variant) throw new NotFoundException('Variant not found')

    const updated = await this.prisma.productVariant.update({
      where: { id: variantId },
      data: { isActive: false },
    })

    if (this.search) fireAndForget(this.search.indexProducts(product.storeId), 'search.indexProducts')
    await this.bustProductCache(product.storeId)
    return updated
  }

  @Delete(':id')
  async archive(@Param('id') id: string, @Req() req: AdminRequest) {
    const existing = await this.prisma.product.findUnique({ where: { id }, select: { storeId: true } })
    if (!existing) throw new NotFoundException('Product not found')
    if (req.adminUser?.storeId && existing.storeId !== req.adminUser.storeId) {
      throw new NotFoundException('Product not found')
    }

    const product = await this.prisma.product.update({
      where: { id },
      data: { isPublished: false, status: 'ARCHIVED' },
    })
    if (this.search) fireAndForget(this.search.deleteFromIndex(id), 'search.deleteFromIndex')
    await this.bustProductCache(product.storeId)
    return product
  }

  /**
   * Erase a product for good — for test rows and mistaken uploads that should
   * never have existed. Refused once the product carries order history, because
   * deleting it there would rewrite past invoices and the revenue they report.
   * Archive that product instead: it leaves the storefront but the books stay true.
   */
  @Delete(':id/permanent')
  async destroy(@Param('id') id: string, @Req() req: AdminRequest) {
    const existing = await this.prisma.product.findUnique({
      where: { id },
      select: { id: true, storeId: true, name: true },
    })
    if (!existing) throw new NotFoundException('Product not found')
    if (req.adminUser?.storeId && existing.storeId !== req.adminUser.storeId) {
      throw new NotFoundException('Product not found')
    }

    const soldCount = await this.prisma.orderItem.count({ where: { productId: id } })
    if (soldCount > 0) {
      throw new BadRequestException(
        `"${existing.name}" appears on ${soldCount} order item${soldCount === 1 ? '' : 's'}. ` +
          'Delete those orders first, or archive the product to hide it without touching the books.',
      )
    }

    await this.prisma.$transaction(async (tx) => {
      // Variants, images, versions, collection links and wishlist entries all
      // cascade. Everything below holds the product — or one of its variants —
      // by a restricting FK, so it has to go first or Postgres refuses.
      await tx.stockReservationItem.deleteMany({
        where: { variant: { productId: id } },
      })
      // Matched on the variant as well as the product: these rows carry both
      // keys, and a row whose two keys disagree would otherwise survive the
      // product sweep and then block the variant cascade.
      await tx.cartItem.deleteMany({
        where: { OR: [{ productId: id }, { variant: { productId: id } }] },
      })
      await tx.inventoryLog.deleteMany({
        where: { OR: [{ productId: id }, { variant: { productId: id } }] },
      })
      await tx.review.deleteMany({ where: { productId: id } })
      await tx.aIJob.deleteMany({ where: { productId: id } })
      await tx.product.delete({ where: { id } })
    })

    if (this.search) fireAndForget(this.search.deleteFromIndex(id), 'search.deleteFromIndex')
    await this.bustProductCache(existing.storeId)
    return { success: true, deleted: id }
  }

  @Post(':id/generate-skus')
  async generateSKUs(@Param('id') id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      select: { storeId: true },
    })
    if (!product) throw new NotFoundException('Product not found')

    const settings = await this.prisma.siteSettings.findUnique({
      where: { storeId: product.storeId },
      select: { storefrontConfig: true },
    })
    const config = mergeStorefrontConfig(settings?.storefrontConfig)
    if (config.catalog?.autoGenerateSku === false) {
      throw new BadRequestException(
        'SKU auto-generation is off. Enter SKUs manually in product edit or SKU manager.',
      )
    }

    const updated = await this.productAdvanced.ensureVariantSKUs(id)
    return { updated }
  }

  @Get(':id/qr')
  async generateQR(@Param('id') id: string, @Query('siteUrl') siteUrl: string, @Req() req: AdminRequest) {
    await this.assertOwnedProduct(id, req)
    const qr = await this.productAdvanced.generateProductQR(id, resolveCustomerFacingSiteUrl(siteUrl))
    return { qr }
  }

  @Get(':id/barcode')
  async generateBarcode(
    @Param('id') id: string,
    @Query('format') format: string | undefined,
    @Req() req: AdminRequest,
  ) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      select: { sku: true, storeId: true },
    })
    if (!product) throw new NotFoundException('Product not found')
    if (req.adminUser?.storeId && product.storeId !== req.adminUser.storeId) {
      throw new NotFoundException('Product not found')
    }

    const sku = product.sku?.trim()
    if (!sku) {
      throw new BadRequestException(
        'Product has no SKU yet — set a SKU before generating a barcode',
      )
    }

    const fmt = (format ?? 'CODE128').toUpperCase()
    if (fmt !== 'CODE128' && fmt !== 'EAN13' && fmt !== 'EAN8') {
      throw new BadRequestException('Invalid barcode format — use CODE128, EAN13, or EAN8')
    }

    const barcode = await this.productAdvanced.generateBarcode(
      sku,
      fmt as 'CODE128' | 'EAN13' | 'EAN8',
    )
    return { barcode }
  }

  @Get(':id/versions')
  async getVersions(@Param('id') id: string, @Req() req: AdminRequest) {
    await this.assertOwnedProduct(id, req)
    return this.productAdvanced.getProductVersionHistory(id)
  }

  @Post(':id/versions/:versionId/restore')
  async restoreVersion(
    @Param('id') id: string,
    @Param('versionId') versionId: string,
    @Body('restoredBy') restoredBy: string,
    @Req() req: AdminRequest,
  ) {
    await this.assertOwnedProduct(id, req)
    const { storeId } = await this.productAdvanced.restoreProductVersion(
      id,
      versionId,
      restoredBy ?? 'admin',
    )
    if (this.search) fireAndForget(this.search.indexProducts(storeId), 'search.indexProducts')
    await this.bustProductCache(storeId)
    return { success: true }
  }

  // ── Tags ────────────────────────────────────────────────────

  @Patch(':id/tags')
  async updateTags(@Param('id') id: string, @Body('tags') tags: string[], @Req() req: AdminRequest) {
    await this.assertOwnedProduct(id, req)
    const product = await this.prisma.product.update({
      where: { id },
      data: { tags: tags ?? [] },
      select: { id: true, tags: true, storeId: true },
    })
    if (this.search) fireAndForget(this.search.indexProducts(product.storeId), 'search.indexProducts')
    await this.bustProductCache(product.storeId)
    return product
  }

  // ── Images ──────────────────────────────────────────────────

  @Post(':id/images')
  async addImage(
    @Param('id') id: string,
    @Body() body: { url: string; altText?: string; isDefault?: boolean },
  ) {
    const owner = await this.prisma.product.findUnique({ where: { id }, select: { storeId: true } })
    if (!owner) throw new NotFoundException('Product not found')

    const mediaType = body.altText === MEDIA_VIDEO_ALT ? 'video' : 'image'
    if (mediaType === 'image') {
      const imageCount = await this.prisma.productImage.count({
        where: { productId: id, NOT: { altText: MEDIA_VIDEO_ALT } },
      })
      if (imageCount >= MAX_PRODUCT_IMAGES) {
        throw new BadRequestException(`Maximum ${MAX_PRODUCT_IMAGES} product images allowed`)
      }
    }
    if (body.isDefault) {
      await this.prisma.productImage.updateMany({ where: { productId: id }, data: { isDefault: false } })
    }
    const count = await this.prisma.productImage.count({ where: { productId: id } })
    const created = await this.prisma.productImage.create({
      data: {
        productId: id,
        url: toStoredMediaUrl(body.url) || body.url.trim(),
        altText: body.altText ?? (mediaType === 'video' ? MEDIA_VIDEO_ALT : MEDIA_IMAGE_ALT),
        isDefault: body.isDefault ?? count === 0,
        position: mediaType === 'video' ? -1 : count,
      },
    })
    await this.bustProductCache(owner.storeId)
    return created
  }

  @Patch(':id/images/:imageId')
  async updateImage(
    @Param('id') id: string,
    @Param('imageId') imageId: string,
    @Body() body: { altText?: string; position?: number; isDefault?: boolean },
  ) {
    if (body.isDefault) {
      await this.prisma.productImage.updateMany({ where: { productId: id }, data: { isDefault: false } })
    }
    return this.prisma.productImage.update({ where: { id: imageId, productId: id }, data: body })
  }

  @Delete(':id/images/:imageId')
  async removeImage(
    @Param('id') id: string,
    @Param('imageId') imageId: string,
    @Req() req: AdminRequest,
  ) {
    await this.assertOwnedProduct(id, req)
    const image = await this.prisma.productImage.findFirst({
      where: { id: imageId, productId: id },
      select: { id: true, url: true, product: { select: { storeId: true } } },
    })
    if (!image) throw new NotFoundException('Product image not found')

    await this.prisma.productImage.delete({ where: { id: imageId, productId: id } })
    await this.bustProductCache(image.product.storeId)

    let fileDeleted = false
    let warning: string | undefined
    if (this.media) {
      const cleanup = await this.media.deleteUploadIfUnreferenced(image.product.storeId, image.url)
      fileDeleted = cleanup.fileDeleted
      warning = cleanup.warning
    }

    return { deleted: true, fileDeleted, ...(warning ? { warning } : {}) }
  }

  // ── Bulk operations ─────────────────────────────────────────

  @Post('bulk/stock')
  async bulkUpdateStock(@Body() body: { updates: { variantId: string; stock: number }[] }) {
    const results = await Promise.allSettled(
      body.updates.map(async ({ variantId, stock }) => {
        const variant = await this.prisma.productVariant.findUnique({ where: { id: variantId } })
        if (!variant) throw new Error(`Variant ${variantId} not found`)
        await this.prisma.productVariant.update({ where: { id: variantId }, data: { stock } })
        await this.prisma.inventoryLog.create({
          data: {
            productId: variant.productId,
            variantId,
            action: 'ADJUSTMENT',
            quantity: stock - variant.stock,
            stockBefore: variant.stock,
            stockAfter: stock,
            note: 'Bulk stock update',
          },
        })
      }),
    )
    const updated = results.filter((r) => r.status === 'fulfilled').length
    return { updated, failed: body.updates.length - updated }
  }

  @Post('bulk/publish')
  async bulkPublish(
    @Query('storeId') storeId: string,
    @Body() body: { ids: string[]; isPublished: boolean },
  ) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const { count } = await this.prisma.product.updateMany({
      where: { id: { in: body.ids }, storeId: sid },
      data: { isPublished: body.isPublished },
    })
    if (this.search) fireAndForget(this.search.indexProducts(sid), 'search.indexProducts')
    await this.bustProductCache(sid)
    return { updated: count }
  }

  @Post('bulk/price')
  async bulkUpdatePrice(
    @Query('storeId') storeId: string,
    @Body()
    body: {
      updates: {
        variantId?: string
        sku?: string
        productId?: string
        price: number
        compareAtPrice?: number | null
      }[]
    },
  ) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const results: { key: string; ok: boolean; error?: string }[] = []

    for (const row of body.updates ?? []) {
      const key = row.sku ?? row.variantId ?? row.productId ?? 'unknown'
      try {
        if (row.price < 0) throw new Error('Price cannot be negative')

        let variant = row.variantId
          ? await this.prisma.productVariant.findFirst({
              where: { id: row.variantId, product: { storeId: sid } },
              include: { product: { select: { id: true } } },
            })
          : null

        if (!variant && row.sku) {
          variant = await this.prisma.productVariant.findFirst({
            where: { sku: row.sku.trim(), product: { storeId: sid } },
            include: { product: { select: { id: true } } },
          })
        }

        if (!variant && row.productId) {
          variant = await this.prisma.productVariant.findFirst({
            where: { productId: row.productId, product: { storeId: sid } },
            orderBy: { createdAt: 'asc' },
            include: { product: { select: { id: true } } },
          })
        }

        if (!variant) throw new Error(`SKU or variant not found: ${key}`)

        await this.prisma.productVariant.update({
          where: { id: variant.id },
          data: {
            price: row.price,
            ...(row.compareAtPrice !== undefined ? { compareAtPrice: row.compareAtPrice } : {}),
          },
        })

        const defaultVariant = await this.prisma.productVariant.findFirst({
          where: { productId: variant.product.id },
          orderBy: { createdAt: 'asc' },
          select: { id: true },
        })
        if (defaultVariant?.id === variant.id) {
          await this.prisma.product.update({
            where: { id: variant.product.id },
            data: {
              basePrice: row.price,
              ...(row.compareAtPrice !== undefined ? { compareAtPrice: row.compareAtPrice } : {}),
            },
          })
        }

        results.push({ key, ok: true })
      } catch (err) {
        results.push({
          key,
          ok: false,
          error: err instanceof Error ? err.message : 'Update failed',
        })
      }
    }

    if (this.search) fireAndForget(this.search.indexProducts(sid), 'search.indexProducts')
    await this.bustProductCache(sid)
    const updated = results.filter((r) => r.ok).length
    return { updated, failed: results.length - updated, results }
  }

  @Post('bulk/catalog')
  async bulkCatalogUpsert(
    @Query('storeId') storeId: string,
    @Body() body: { rows?: CatalogBulkRowInput[] },
  ) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const rows = body.rows ?? []
    if (rows.length === 0) {
      throw new BadRequestException('rows required')
    }
    if (rows.length > CATALOG_BULK_MAX_ROWS) {
      throw new BadRequestException(
        `At most ${CATALOG_BULK_MAX_ROWS} rows per request — split the file and retry.`,
      )
    }

    const results = await upsertCatalogRowsBatch(this.prisma, sid, rows)
    let created = 0
    let updated = 0
    for (const result of results) {
      if (result.ok && result.action === 'created') created += 1
      if (result.ok && result.action === 'updated') updated += 1
    }

    const touchedProductIds = [
      ...new Set(results.filter((r) => r.ok && r.productId).map((r) => r.productId!)),
    ]
    for (const productId of touchedProductIds) {
      await this.productAdvanced.ensureVariantSKUs(productId)
    }

    if (this.search) fireAndForget(this.search.indexProducts(sid), 'search.indexProducts')
    await this.bustProductCache(sid)
    const failed = results.filter((r) => !r.ok).length
    return { created, updated, failed, results }
  }
}
