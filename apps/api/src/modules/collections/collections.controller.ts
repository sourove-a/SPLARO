import { Body, Controller, Delete, Get, Patch, Post, Param, Query } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'
import { resolveStoreId, slugify } from '../../common/store.util'

@Controller('admin/collections')
export class CollectionsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Query('storeId') storeId: string) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const collections = await this.prisma.collection.findMany({
      where: { storeId: sid },
      include: { _count: { select: { products: true } } },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    })
    return { collections, total: collections.length }
  }

  @Post()
  async create(
    @Query('storeId') storeId: string,
    @Body() body: { name: string; description?: string; image?: string },
  ) {
    const sid = await resolveStoreId(this.prisma, storeId)
    let slug = slugify(body.name)
    const existing = await this.prisma.collection.findUnique({
      where: { storeId_slug: { storeId: sid, slug } },
    })
    if (existing) slug = `${slug}-${Date.now().toString(36)}`

    return this.prisma.collection.create({
      data: {
        storeId: sid,
        name: body.name,
        slug,
        description: body.description,
        image: body.image,
        isActive: true,
      },
      include: { _count: { select: { products: true } } },
    })
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Query('storeId') storeId: string,
    @Body() body: { name?: string; description?: string; image?: string; isActive?: boolean; sortOrder?: number },
  ) {
    const sid = await resolveStoreId(this.prisma, storeId)
    return this.prisma.collection.update({
      where: { id, storeId: sid },
      data: body,
      include: { _count: { select: { products: true } } },
    })
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Query('storeId') storeId: string) {
    const sid = await resolveStoreId(this.prisma, storeId)
    await this.prisma.collection.delete({ where: { id, storeId: sid } })
    return { deleted: true }
  }
}
