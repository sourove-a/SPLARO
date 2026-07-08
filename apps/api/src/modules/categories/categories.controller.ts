import { BadRequestException, Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Query } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'
import { resolveStoreId, slugify } from '../../common/store.util'
import { revalidateStorefrontWeb } from '../../common/revalidate-web'

@Controller('admin/categories')
export class CategoriesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Query('storeId') storeId: string) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const categories = await this.prisma.category.findMany({
      where: { storeId: sid },
      include: { _count: { select: { products: true } } },
      orderBy: { sortOrder: 'asc' },
    })
    return { categories, total: categories.length }
  }

  @Post()
  async create(
    @Query('storeId') storeId: string,
    @Body() body: { name: string; description?: string; parentId?: string },
  ) {
    const sid = await resolveStoreId(this.prisma, storeId)
    let slug = slugify(body.name)
    const existing = await this.prisma.category.findUnique({
      where: { storeId_slug: { storeId: sid, slug } },
    })
    if (existing) slug = `${slug}-${Date.now().toString(36)}`

    const category = await this.prisma.category.create({
      data: {
        storeId: sid,
        name: body.name,
        slug,
        description: body.description,
        parentId: body.parentId,
      },
    })
    void revalidateStorefrontWeb(['storefront-categories'])
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
      storeId?: string
    },
  ) {
    const sid = await resolveStoreId(this.prisma, body.storeId)
    const category = await this.prisma.category.findFirst({ where: { id, storeId: sid } })
    if (!category) throw new NotFoundException('Category not found')

    const updated = await this.prisma.category.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
        ...(body.image !== undefined ? { image: body.image } : {}),
      },
    })
    void revalidateStorefrontWeb(['storefront-categories'])
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
    void revalidateStorefrontWeb(['storefront-categories'])
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
    void revalidateStorefrontWeb(['storefront-categories'])
    return { updated: order.length }
  }
}
