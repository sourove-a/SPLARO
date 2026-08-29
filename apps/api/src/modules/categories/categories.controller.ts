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

  /**
   * Two counts, because they answer different questions. `_count.products` is
   * what the storefront shows (live products only) and drives the "empty —
   * hidden on site" badge; `totalProducts` is every product filed here, draft
   * and archived included, and is what actually blocks a delete. Reporting only
   * the first made the dashboard offer a delete on a category reading "0
   * products" that the server then refused.
   */
  private async categoriesWithCounts(storeId: string) {
    const [categories, totals] = await Promise.all([
      this.prisma.category.findMany({
        where: { storeId },
        include: {
          _count: {
            select: {
              products: { where: storefrontVisibleProductWhere() },
            },
          },
        },
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.product.groupBy({
        by: ['categoryId'],
        where: { storeId, categoryId: { not: null } },
        _count: { _all: true },
      }),
    ])

    const totalByCategory = new Map(
      totals.map((row) => [row.categoryId as string, row._count._all]),
    )
    return categories.map((category) => ({
      ...category,
      totalProducts: totalByCategory.get(category.id) ?? 0,
    }))
  }

  /** First free slug in the `base`, `base-2`, `base-3` … series. */
  private async freeSlug(storeId: string, base: string): Promise<string> {
    const taken = new Set(
      (
        await this.prisma.category.findMany({
          where: { storeId, OR: [{ slug: base }, { slug: { startsWith: `${base}-` } }] },
          select: { slug: true },
        })
      ).map((row) => row.slug),
    )
    if (!taken.has(base)) return base
    for (let n = 2; n <= taken.size + 2; n++) {
      const candidate = `${base}-${n}`
      if (!taken.has(candidate)) return candidate
    }
    return `${base}-${Date.now().toString(36)}`
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
    // `saree`, then `saree-2`, `saree-3` — the slug is the public URL, so a
    // collision must not turn it into `saree-m1a2b3c`.
    const slug = await this.freeSlug(sid, slugify(name))

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
      include: { _count: { select: { products: true, children: true } } },
    })
    if (!category) throw new NotFoundException('Category not found')
    if (category._count.products > 0) {
      // Drafts and archived products count too — they are still filed here.
      throw new BadRequestException(
        `${category._count.products} product(s) are still in "${category.name}" — move or delete them first.`,
      )
    }
    // Children are detached rather than deleted; they resurface as top-level
    // categories, which the dashboard warns about before the delete. Both
    // statements run together so a failed delete cannot leave them orphaned.
    await this.prisma.$transaction([
      ...(category._count.children > 0
        ? [this.prisma.category.updateMany({ where: { parentId: id }, data: { parentId: null } })]
        : []),
      this.prisma.category.delete({ where: { id } }),
    ])
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
    const rows = (order ?? []).filter((row) => row?.id && Number.isFinite(row.sortOrder))
    if (!rows.length) throw new BadRequestException('Nothing to reorder.')

    const owned = await this.prisma.category.findMany({
      where: { storeId: sid, id: { in: rows.map((row) => row.id) } },
      select: { id: true },
    })
    if (owned.length !== rows.length) {
      throw new BadRequestException('Reorder includes a category that is not on this store.')
    }

    // One transaction: a half-applied order is worse than a rejected one,
    // because the operator cannot see which half landed.
    await this.prisma.$transaction(
      rows.map(({ id, sortOrder }) =>
        this.prisma.category.update({ where: { id }, data: { sortOrder } }),
      ),
    )
    await refreshCategoryCatalogAfterMutation(this.cache, sid)
    return { updated: rows.length }
  }
}
