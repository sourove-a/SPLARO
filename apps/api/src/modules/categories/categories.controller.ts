import { BadRequestException, Body, Controller, Delete, Get, Inject, NotFoundException, Param, Patch, Post, Query } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'
import { CacheService } from '../../common/cache.service'
import { buildCategoryTree } from '../../common/category-tree.util'
import { seedDefaultCategoryTree } from '../../common/category-seed.util'
import { resolveStoreId, slugify } from '../../common/store.util'
import { storefrontVisibleProductWhere } from '../../common/storefront-product.util'
import { refreshCategoryCatalogAfterMutation } from '../products/product-catalog-refresh.util'

@Controller('admin/categories')
export class CategoriesController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CacheService) private readonly cache: CacheService,
  ) {}

  private async categoriesWithCounts(storeId: string) {
    return this.prisma.category.findMany({
      where: { storeId },
      include: {
        _count: {
          select: {
            products: { where: storefrontVisibleProductWhere() },
          },
        },
      },
      orderBy: { sortOrder: 'asc' },
    })
  }

  @Get('tree')
  async tree(@Query('storeId') storeId: string) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const categories = await this.categoriesWithCounts(sid)
    return { categories, tree: buildCategoryTree(categories), total: categories.length }
  }

  @Get()
  async list(@Query('storeId') storeId: string) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const categories = await this.categoriesWithCounts(sid)
    return { categories, total: categories.length }
  }

  @Post('seed-defaults')
  async seedDefaults(@Query('storeId') storeId: string) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const result = await seedDefaultCategoryTree(this.prisma, sid)
    await refreshCategoryCatalogAfterMutation(this.cache, sid)
    return { success: true, ...result }
  }

  @Post()
  async create(
    @Query('storeId') storeId: string,
    @Body() body: { name: string; description?: string; parentId?: string; sortOrder?: number; image?: string },
  ) {
    const sid = await resolveStoreId(this.prisma, storeId)
    let slug = slugify(body.name)
    const existing = await this.prisma.category.findUnique({
      where: { storeId_slug: { storeId: sid, slug } },
    })
    if (existing) slug = `${slug}-${Date.now().toString(36)}`

    const maxSort = body.parentId
      ? await this.prisma.category.aggregate({
          where: { storeId: sid, parentId: body.parentId },
          _max: { sortOrder: true },
        })
      : await this.prisma.category.aggregate({
          where: { storeId: sid, parentId: null },
          _max: { sortOrder: true },
        })

    const category = await this.prisma.category.create({
      data: {
        storeId: sid,
        name: body.name,
        slug,
        description: body.description,
        parentId: body.parentId,
        image: body.image,
        sortOrder: body.sortOrder ?? (maxSort._max.sortOrder ?? 0) + 1,
      },
      include: { _count: { select: { products: true } } },
    })
    await refreshCategoryCatalogAfterMutation(this.cache, sid)
    return category
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() body: {
      name?: string
      description?: string
      isActive?: boolean
      image?: string | null
      parentId?: string | null
      sortOrder?: number
      storeId?: string
    },
  ) {
    const sid = await resolveStoreId(this.prisma, body.storeId)
    const category = await this.prisma.category.findFirst({ where: { id, storeId: sid } })
    if (!category) throw new NotFoundException('Category not found')

    if (body.parentId === id) {
      throw new BadRequestException('Category cannot be its own parent.')
    }

    const updated = await this.prisma.category.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
        ...(body.image !== undefined ? { image: body.image } : {}),
        ...(body.parentId !== undefined ? { parentId: body.parentId } : {}),
        ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
      },
      include: { _count: { select: { products: true } } },
    })
    await refreshCategoryCatalogAfterMutation(this.cache, sid)
    return updated
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Query('storeId') storeId?: string) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const category = await this.prisma.category.findFirst({
      where: { id, storeId: sid },
      include: { _count: { select: { products: true } } },
    })
    if (!category) throw new NotFoundException('Category not found')
    if (category._count.products > 0) {
      throw new BadRequestException('Move or delete products in this category first.')
    }
    await this.prisma.category.delete({ where: { id } })
    await refreshCategoryCatalogAfterMutation(this.cache, sid)
    return { success: true }
  }

  @Post('reorder')
  async reorder(
    @Query('storeId') storeId: string,
    @Body('order') order: { id: string; sortOrder: number }[],
  ) {
    const sid = await resolveStoreId(this.prisma, storeId)
    await Promise.all(
      order.map(({ id, sortOrder }) =>
        this.prisma.category.update({ where: { id, storeId: sid }, data: { sortOrder } }),
      ),
    )
    await refreshCategoryCatalogAfterMutation(this.cache, sid)
    return { updated: order.length }
  }
}
