import { BadRequestException, Controller, Get, Post, Patch, Delete, Param, Query, Body, NotFoundException, Optional, Inject } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'
import { CacheService } from '../../common/cache.service'
import { ProductAdvancedService } from './product-advanced.service'
import { SearchService } from '../search/search.service'
import { resolveStoreId, slugify } from '../../common/store.util'

const MAX_PRODUCT_IMAGES = 10
const MEDIA_VIDEO_ALT = 'media:video'
const MEDIA_IMAGE_ALT = 'media:image'

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
          variants: { select: { id: true, stock: true, sku: true, size: true, color: true, colorName: true, price: true } },
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

  @Post()
  async create(
    @Query('storeId') storeId: string,
    @Body()
    body: {
      name: string
      description?: string
      basePrice: number
      compareAtPrice?: number
      categoryId?: string
      isPublished?: boolean
      imageUrl?: string
      imageUrls?: string[]
      videoUrl?: string
      sizes?: string[]
      colors?: Array<string | { name: string; hex: string; image?: string }>
      fabricContent?: string
      fitType?: string
      occasion?: string
      metaTitle?: string
      metaDescription?: string
      defaultStock?: number
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

    const product = await this.prisma.product.create({
      data: {
        storeId: sid,
        name: body.name,
        slug,
        description: body.description,
        basePrice: body.basePrice,
        compareAtPrice: body.compareAtPrice,
        categoryId: body.categoryId,
        isPublished: body.isPublished ?? false,
        fabricContent: body.fabricContent,
        fitType: body.fitType,
        occasion: body.occasion,
        metaTitle: body.metaTitle,
        metaDescription: body.metaDescription,
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
            })),
          ),
        },
      },
      include: { images: true, variants: true, category: true },
    })

    void this.search?.indexProducts(sid)
    await this.bustProductCache(sid)
    return product
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.prisma.product.findUnique({
      where: { id },
      include: { images: true, variants: true, category: true, collections: true },
    })
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body()
    body: {
      name?: string
      description?: string
      basePrice?: number
      categoryId?: string
      isPublished?: boolean
      imageUrl?: string
      imageUrls?: string[]
      videoUrl?: string
      fabricContent?: string
      fitType?: string
    },
  ) {
    const imageUrls = Array.from(
      new Set(
        [body.imageUrl, ...(body.imageUrls ?? [])]
          .map((url) => url?.trim())
          .filter(Boolean) as string[],
      ),
    ).slice(0, MAX_PRODUCT_IMAGES)
    const videoUrl = body.videoUrl?.trim()

    const product = await this.prisma.product.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.basePrice !== undefined ? { basePrice: body.basePrice } : {}),
        ...(body.categoryId !== undefined ? { categoryId: body.categoryId } : {}),
        ...(body.isPublished !== undefined ? { isPublished: body.isPublished } : {}),
        ...(body.fabricContent !== undefined ? { fabricContent: body.fabricContent } : {}),
        ...(body.fitType !== undefined ? { fitType: body.fitType } : {}),
      },
      include: { images: true, variants: true, category: true },
    })

    if (imageUrls.length || videoUrl) {
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
      include: { images: true, variants: true, category: true },
    })
  }

  @Patch(':id/variants/:variantId')
  async updateVariant(
    @Param('id') productId: string,
    @Param('variantId') variantId: string,
    @Body() body: { stock?: number; price?: number; isActive?: boolean; sku?: string },
  ) {
    const variant = await this.prisma.productVariant.findFirst({ where: { id: variantId, productId } })
    if (!variant) throw new NotFoundException('Variant not found')

    const updated = await this.prisma.productVariant.update({
      where: { id: variantId },
      data: {
        ...(body.stock !== undefined ? { stock: body.stock } : {}),
        ...(body.price !== undefined ? { price: body.price } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
        ...(body.sku !== undefined ? { sku: body.sku } : {}),
      },
    })

    if (body.stock !== undefined) {
      await this.prisma.inventoryLog.create({
        data: {
          productId,
          variantId,
          action: 'ADJUSTMENT',
          quantity: body.stock - variant.stock,
          stockBefore: variant.stock,
          stockAfter: body.stock,
          note: 'Admin manual update',
        },
      })
    }

    return updated
  }

  @Delete(':id')
  async archive(@Param('id') id: string) {
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
    const updated = await this.productAdvanced.ensureVariantSKUs(id)
    return { updated }
  }

  @Get(':id/qr')
  async generateQR(@Param('id') id: string, @Query('siteUrl') siteUrl: string) {
    const qr = await this.productAdvanced.generateProductQR(id, siteUrl)
    return { qr }
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
    await this.productAdvanced.restoreProductVersion(id, versionId, restoredBy)
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

  // ── Reviews (admin) ─────────────────────────────────────────

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
    @Body() body: { status: 'APPROVED' | 'REJECTED' | 'PENDING' },
  ) {
    const review = await this.prisma.review.update({ where: { id }, data: { status: body.status } })
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
    return review
  }

  @Delete('reviews/:id')
  async deleteReview(@Param('id') id: string) {
    await this.prisma.review.delete({ where: { id } })
    return { deleted: true }
  }
}
