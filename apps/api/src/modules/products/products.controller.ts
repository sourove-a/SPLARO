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
import { PrismaService } from '../../common/prisma.service'
import { CacheService } from '../../common/cache.service'
import { ProductAdvancedService } from './product-advanced.service'
import { SearchService } from '../search/search.service'
import { resolveStoreId, slugify } from '../../common/store.util'
import { revalidateStorefrontWeb } from '../../common/revalidate-web'
import { mergeStorefrontConfig } from '../settings/storefront-config'
import type { AdminSessionPayload } from '../../common/auth/admin-session.util'

type AdminRequest = Request & { adminUser?: AdminSessionPayload }

const MAX_PRODUCT_IMAGES = 10
const MEDIA_VIDEO_ALT = 'media:video'
const MEDIA_IMAGE_ALT = 'media:image'

type AdminProductWriteBody = {
  name?: string
  nameBn?: string
  description?: string
  shortDescription?: string
  basePrice?: number
  compareAtPrice?: number | null
  costPrice?: number | null
  sku?: string
  lowStockThreshold?: number
  tags?: string[]
  weavingType?: string
  collectionId?: string
  categoryId?: string
  isPublished?: boolean
  isHidden?: boolean
  status?: string
  imageUrl?: string
  imageUrls?: string[]
  videoUrl?: string
  fabricContent?: string
  fitType?: string
  occasion?: string
  careInstructions?: string
  metaTitle?: string
  metaDescription?: string
  season?: string
  slug?: string
  isFeatured?: boolean
  isNewArrival?: boolean
  isBestSeller?: boolean
  weight?: number | null
  badge?: string | null
  rmCode?: string | null
  barcode?: string | null
  qrCode?: string | null
  publishAt?: string | null
  /** When true, skip pre-update version snapshot (visibility toggles). */
  skipVersionSnapshot?: boolean
}

const VISIBILITY_ONLY_PATCH_KEYS = new Set([
  'isPublished',
  'isHidden',
  'status',
  'isFeatured',
  'isNewArrival',
  'isBestSeller',
  'skipVersionSnapshot',
])

function shouldSkipVersionSnapshot(body: AdminProductWriteBody): boolean {
  if (body.skipVersionSnapshot === true) return true
  const keys = Object.keys(body).filter(
    (key) => body[key as keyof AdminProductWriteBody] !== undefined,
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

function mergeSchemaMarkup(
  existing: unknown,
  nameBn?: string,
  weavingType?: string,
): Record<string, string> | undefined {
  const base =
    existing && typeof existing === 'object' && !Array.isArray(existing)
      ? { ...(existing as Record<string, string>) }
      : {}
  if (nameBn !== undefined) {
    if (nameBn.trim()) base.nameBn = nameBn.trim()
    else delete base.nameBn
  }
  if (weavingType !== undefined) {
    if (weavingType.trim()) base.weavingType = weavingType.trim()
    else delete base.weavingType
  }
  return Object.keys(base).length ? base : undefined
}

@Controller('admin/products')
export class ProductsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly productAdvanced: ProductAdvancedService,
    @Inject(CacheService) private readonly cache: CacheService,
    @Optional() private readonly search: SearchService,
  ) {}

  private async bustProductCache(storeId: string): Promise<void> {
    await this.cache.invalidateStoreResource(storeId, 'products')
    void revalidateStorefrontWeb(['storefront-products'])
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
    const skip = (Number(page) - 1) * Number(limit)
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
          category: { select: { name: true } },
          variants: { select: { id: true, stock: true, reservedStock: true, sku: true, size: true, color: true, colorName: true, price: true } },
          _count: { select: { variants: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
      }),
      this.prisma.product.count({ where }),
    ])

    return { products, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) }
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
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
      }),
      this.prisma.review.count({ where }),
    ])
    return { reviews, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) }
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
    @Body()
    body: {
      name: string
      nameBn?: string
      description?: string
      shortDescription?: string
      basePrice: number
      compareAtPrice?: number
      costPrice?: number
      sku?: string
      lowStockThreshold?: number
      tags?: string[]
      weavingType?: string
      collectionId?: string
      categoryId?: string
      isPublished?: boolean
      isHidden?: boolean
      status?: string
      imageUrl?: string
      imageUrls?: string[]
      videoUrl?: string
      sizes?: string[]
      colors?: Array<string | { name: string; hex: string; image?: string }>
      fabricContent?: string
      fitType?: string
      occasion?: string
      careInstructions?: string
      season?: string
      metaTitle?: string
      metaDescription?: string
      defaultStock?: number
      isFeatured?: boolean
      isNewArrival?: boolean
      isBestSeller?: boolean
      weight?: number | null
      badge?: string | null
      rmCode?: string | null
      barcode?: string | null
      qrCode?: string | null
      publishAt?: string | null
    },
  ) {
    const sid = await resolveStoreId(this.prisma, storeId)
    let slug = slugify(body.name)
    const clash = await this.prisma.product.findFirst({ where: { storeId: sid, slug } })
    if (clash) slug = `${slug}-${Date.now().toString(36)}`

    const sizes = body.sizes?.length ? body.sizes : ['M', 'L']
    const variantStock = Math.max(0, Math.min(9999, Number(body.defaultStock) || 10))
    const imageUrls = Array.from(new Set([body.imageUrl, ...(body.imageUrls ?? [])]
      .map((url) => url?.trim())
      .filter(Boolean) as string[])).slice(0, MAX_PRODUCT_IMAGES)
    const primaryImage = imageUrls[0]
    const videoUrl = body.videoUrl?.trim()
    const mediaRows = [
      ...(videoUrl ? [{ url: videoUrl, altText: MEDIA_VIDEO_ALT, isDefault: imageUrls.length === 0, position: -1 }] : []),
      ...imageUrls.map((url, index) => ({
        url,
        altText: MEDIA_IMAGE_ALT,
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
          hex: '#111111',
          image: imageUrls[index] ?? primaryImage,
        }
      }
      return {
        name: color.name,
        hex: color.hex,
        image: color.image ?? imageUrls[index] ?? primaryImage,
      }
    })

    const schemaExtras: Record<string, string> = {}
    if (body.nameBn?.trim()) schemaExtras.nameBn = body.nameBn.trim()
    if (body.weavingType?.trim()) schemaExtras.weavingType = body.weavingType.trim()

    const productSku = body.sku?.trim()

    const publishState = resolvePublishState(body)

    const product = await this.prisma.product.create({
      data: {
        storeId: sid,
        name: body.name,
        slug,
        description: body.description,
        shortDescription: body.shortDescription,
        basePrice: body.basePrice,
        compareAtPrice: body.compareAtPrice,
        costPrice: body.costPrice,
        sku: productSku || undefined,
        rmCode: optionalTrimmed(body.rmCode) ?? undefined,
        barcode: optionalTrimmed(body.barcode) ?? undefined,
        qrCode: optionalTrimmed(body.qrCode) ?? undefined,
        weight: body.weight != null ? body.weight : undefined,
        badge: optionalTrimmed(body.badge) ?? undefined,
        lowStockThreshold: body.lowStockThreshold ?? 5,
        tags: body.tags ?? [],
        categoryId: body.categoryId,
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
          create: sizes.flatMap((size) =>
            normalizedColors.map((color) => ({
              size,
              color: color.name,
              colorHex: color.hex,
              colorName: color.name,
              price: body.basePrice,
              stock: variantStock,
              image: color.image ?? primaryImage,
              ...(productSku
                ? { sku: `${productSku}-${size}-${color.name}`.replace(/\s+/g, '-').slice(0, 80) }
                : {}),
            })),
          ),
        },
      },
      include: { images: true, variants: true, category: true },
    })

    if (body.collectionId) {
      await this.prisma.collectionProduct.upsert({
        where: {
          collectionId_productId: { collectionId: body.collectionId, productId: product.id },
        },
        create: { collectionId: body.collectionId, productId: product.id },
        update: {},
      })
    }

    void this.search?.indexProducts(sid)
    await this.bustProductCache(sid)
    return product
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
  async update(@Param('id') id: string, @Body() body: AdminProductWriteBody, @Req() req: AdminRequest) {
    const existing = await this.prisma.product.findUnique({
      where: { id },
      select: { storeId: true, schemaMarkup: true },
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

    const schemaMarkup =
      body.nameBn !== undefined || body.weavingType !== undefined
        ? mergeSchemaMarkup(existing.schemaMarkup, body.nameBn, body.weavingType)
        : undefined

    const imageUrls = Array.from(
      new Set(
        [body.imageUrl, ...(body.imageUrls ?? [])]
          .map((url) => url?.trim())
          .filter(Boolean) as string[],
      ),
    ).slice(0, MAX_PRODUCT_IMAGES)
    const videoUrl = body.videoUrl !== undefined ? body.videoUrl?.trim() : undefined
    const mediaUpdateRequested =
      body.imageUrls !== undefined || body.videoUrl !== undefined || body.imageUrl !== undefined

    const product = await this.prisma.product.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.slug !== undefined ? { slug: slugify(body.slug) } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.shortDescription !== undefined ? { shortDescription: body.shortDescription } : {}),
        ...(body.basePrice !== undefined ? { basePrice: body.basePrice } : {}),
        ...(body.compareAtPrice !== undefined ? { compareAtPrice: body.compareAtPrice } : {}),
        ...(body.costPrice !== undefined ? { costPrice: body.costPrice } : {}),
        ...(body.sku !== undefined ? { sku: body.sku.trim() || null } : {}),
        ...(body.lowStockThreshold !== undefined ? { lowStockThreshold: body.lowStockThreshold } : {}),
        ...(body.tags !== undefined ? { tags: body.tags } : {}),
        ...(schemaMarkup !== undefined ? { schemaMarkup } : {}),
        ...(body.categoryId !== undefined ? { categoryId: body.categoryId || null } : {}),
        ...(publishPatch
          ? {
              isPublished: publishPatch.isPublished,
              status: publishPatch.status,
              publishAt: publishPatch.publishAt,
            }
          : {}),
        ...(body.weight !== undefined ? { weight: body.weight } : {}),
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
      await this.prisma.productImage.create({
        data: { productId: id, url: body.imageUrl, isDefault: true, position: 0 },
      })
    }

    void this.search?.indexProducts(product.storeId)
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

    const variant = await this.prisma.productVariant.create({
      data: {
        productId,
        size,
        color,
        colorName: body.colorName?.trim() || color || null,
        colorHex: body.colorHex?.trim() || null,
        image: body.image?.trim() || null,
        sku: sku ?? null,
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

    void this.search?.indexProducts(product.storeId)
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
        ...(body.size !== undefined ? { size: nextSize } : {}),
        ...(body.color !== undefined ? { color: nextColor } : {}),
        ...(body.colorName !== undefined ? { colorName: body.colorName.trim() || null } : {}),
        ...(body.colorHex !== undefined ? { colorHex: body.colorHex.trim() || null } : {}),
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

    void this.search?.indexProducts(product.storeId)
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

    void this.search?.indexProducts(product.storeId)
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
    void this.search?.deleteFromIndex(id)
    await this.bustProductCache(product.storeId)
    return product
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
  async generateQR(@Param('id') id: string, @Query('siteUrl') siteUrl: string) {
    const qr = await this.productAdvanced.generateProductQR(id, siteUrl)
    return { qr }
  }

  @Get(':id/barcode')
  async generateBarcode(
    @Param('id') id: string,
    @Query('format') format?: string,
  ) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      select: { sku: true },
    })
    if (!product) throw new NotFoundException('Product not found')

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
  async getVersions(@Param('id') id: string) {
    return this.productAdvanced.getProductVersionHistory(id)
  }

  @Post(':id/versions/:versionId/restore')
  async restoreVersion(
    @Param('id') id: string,
    @Param('versionId') versionId: string,
    @Body('restoredBy') restoredBy: string,
  ) {
    const { storeId } = await this.productAdvanced.restoreProductVersion(
      id,
      versionId,
      restoredBy ?? 'admin',
    )
    void this.search?.indexProducts(storeId)
    await this.bustProductCache(storeId)
    return { success: true }
  }

  // ── Tags ────────────────────────────────────────────────────

  @Patch(':id/tags')
  async updateTags(@Param('id') id: string, @Body('tags') tags: string[]) {
    const product = await this.prisma.product.update({
      where: { id },
      data: { tags: tags ?? [] },
      select: { id: true, tags: true, storeId: true },
    })
    void this.search?.indexProducts(product.storeId)
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
        url: body.url,
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
  async removeImage(@Param('id') id: string, @Param('imageId') imageId: string) {
    await this.prisma.productImage.delete({ where: { id: imageId, productId: id } })
    return { deleted: true }
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
    void this.search?.indexProducts(sid)
    await this.bustProductCache(sid)
    return { updated: count }
  }
}
