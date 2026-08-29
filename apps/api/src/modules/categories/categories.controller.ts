import { BadRequestException, Body, Controller, Delete, Get, Inject, NotFoundException, Param, Patch, Post, Query } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'
import { CacheService } from '../../common/cache.service'
import { buildCategoryTree } from '../../common/category-tree.util'
import { seedDefaultCategoryTree } from '../../common/category-seed.util'
import { resolveStoreId, slugify } from '../../common/store.util'
import { storefrontVisibleProductWhere } from '../../common/storefront-product.util'
import { refreshCategoryCatalogAfterMutation } from '../products/product-catalog-refresh.util'
import { issueCategoryCode } from '../products/category-code.service'

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

  /** A parent must be a live category on this store, never a foreign id. */
  private async assertParent(storeId: string, parentId: string): Promise<void> {
    const parent = await this.prisma.category.findFirst({
      where: { id: parentId, storeId },
      select: { id: true },
    })
    if (!parent) {
      throw new BadRequestException('Parent category not found on this store.')
    }
  }

  /**
   * Re-parenting a category under its own descendant would make a cycle: the
   * loop has no root, so every category in it disappears from the tree — and
   * from the product form with it.
   */
  private async assertNotDescendant(storeId: string, id: string, parentId: string): Promise<void> {
    const rows = await this.prisma.category.findMany({
      where: { storeId },
      select: { id: true, parentId: true },
    })
    const parentOf = new Map(rows.map((row) => [row.id, row.parentId]))
    const seen = new Set<string>()
    let current: string | null = parentId
    while (current && !seen.has(current)) {
      if (current === id) {
        throw new BadRequestException('Category cannot move under one of its own subcategories.')
      }
      seen.add(current)
      current = parentOf.get(current) ?? null
    }
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
    const name = body.name?.trim() ?? ''
    if (!name) throw new BadRequestException('Category name is required.')
    const parentId = body.parentId?.trim() || null
    if (parentId) await this.assertParent(sid, parentId)
    let slug = slugify(name)
    const existing = await this.prisma.category.findUnique({
      where: { storeId_slug: { storeId: sid, slug } },
    })
    if (existing) slug = `${slug}-${Date.now().toString(36)}`

    const maxSort = parentId
      ? await this.prisma.category.aggregate({
          where: { storeId: sid, parentId },
          _max: { sortOrder: true },
        })
      : await this.prisma.category.aggregate({
          where: { storeId: sid, parentId: null },
          _max: { sortOrder: true },
        })

    const parentLabels = parentId
      ? await this.prisma.category
          .findUnique({ where: { id: parentId }, select: { name: true, slug: true } })
          .then((row) => [row?.name, row?.slug])
      : []

    // The operator names the category; SPLARO assigns its permanent number.
    // Allocated in the same transaction as the row so a failure cannot leave a
    // category without a code or burn a number on a category that never existed.
    const category = await this.prisma.$transaction(async (tx) => {
      const code = await issueCategoryCode(tx, {
        storeId: sid,
        labels: [name, slug],
        department: parentLabels,
      })
      const created = await tx.category.create({
        data: {
          storeId: sid,
          name,
          slug,
          code,
          description: body.description,
          parentId,
          image: body.image,
          sortOrder: body.sortOrder ?? (maxSort._max.sortOrder ?? 0) + 1,
        },
        include: { _count: { select: { products: true } } },
      })
      await tx.$executeRaw`
        UPDATE "IssuedCategoryCode" SET "categoryId" = ${created.id} WHERE "code" = ${code}
      `
      return created
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
    const nextParentId = body.parentId === undefined ? undefined : body.parentId?.trim() || null
    if (nextParentId) {
      await this.assertParent(sid, nextParentId)
      await this.assertNotDescendant(sid, id, nextParentId)
    }

    const updated = await this.prisma.category.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
        ...(body.image !== undefined ? { image: body.image } : {}),
        ...(nextParentId !== undefined ? { parentId: nextParentId } : {}),
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
    // The ledger row stays: SKUs issued under this code are still in orders and
    // on labels, so the number must never be handed to another category.
    await this.prisma.$executeRaw`
      UPDATE "IssuedCategoryCode" SET "categoryId" = NULL WHERE "categoryId" = ${id}
    `
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
