import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'
import { resolveStoreId } from '../../common/store.util'

@Controller('admin/banners')
export class BannersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(
    @Query('storeId') storeId: string,
    @Query('position') position?: string,
    @Query('active') active?: string,
  ) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const banners = await this.prisma.banner.findMany({
      where: {
        storeId: sid,
        ...(position ? { position } : {}),
        ...(active !== undefined ? { isActive: active === 'true' } : {}),
      },
      orderBy: [{ position: 'asc' }, { sortOrder: 'asc' }],
    })
    return { banners, total: banners.length }
  }

  @Get('stats')
  async stats(@Query('storeId') storeId: string) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const [byPosition, active, scheduled] = await Promise.all([
      this.prisma.banner.groupBy({ by: ['position'], where: { storeId: sid }, _count: true }),
      this.prisma.banner.count({ where: { storeId: sid, isActive: true } }),
      this.prisma.banner.count({ where: { storeId: sid, startsAt: { gt: new Date() } } }),
    ])
    return { byPosition, active, scheduled }
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.prisma.banner.findUnique({ where: { id } })
  }

  @Post()
  async create(
    @Query('storeId') storeId: string,
    @Body()
    body: {
      image: string
      mobileImage?: string
      title?: string
      subtitle?: string
      linkUrl?: string
      linkText?: string
      position?: string
      sortOrder?: number
      isActive?: boolean
      startsAt?: string
      expiresAt?: string
    },
  ) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const count = await this.prisma.banner.count({ where: { storeId: sid } })
    return this.prisma.banner.create({
      data: {
        storeId: sid,
        image: body.image,
        mobileImage: body.mobileImage,
        title: body.title,
        subtitle: body.subtitle,
        linkUrl: body.linkUrl,
        linkText: body.linkText,
        position: body.position ?? 'hero',
        sortOrder: body.sortOrder ?? count,
        isActive: body.isActive ?? true,
        startsAt: body.startsAt ? new Date(body.startsAt) : undefined,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
      },
    })
  }

  @Patch('bulk/sort')
  async bulkSort(@Body() body: { items: { id: string; sortOrder: number }[] }) {
    await Promise.all(
      body.items.map((item) =>
        this.prisma.banner.update({ where: { id: item.id }, data: { sortOrder: item.sortOrder } }),
      ),
    )
    return { ok: true, updated: body.items.length }
  }

  @Patch('bulk/toggle')
  async bulkToggle(
    @Query('storeId') storeId: string,
    @Body() body: { position?: string; isActive: boolean },
  ) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const result = await this.prisma.banner.updateMany({
      where: { storeId: sid, ...(body.position ? { position: body.position } : {}) },
      data: { isActive: body.isActive },
    })
    return { ok: true, updated: result.count }
  }

  @Post('expire')
  async expireBanners(@Query('storeId') storeId: string) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const result = await this.prisma.banner.updateMany({
      where: { storeId: sid, expiresAt: { lt: new Date() }, isActive: true },
      data: { isActive: false },
    })
    return { expired: result.count }
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body()
    body: {
      image?: string
      mobileImage?: string
      title?: string
      subtitle?: string
      linkUrl?: string
      linkText?: string
      position?: string
      isActive?: boolean
      sortOrder?: number
      startsAt?: string
      expiresAt?: string
    },
  ) {
    return this.prisma.banner.update({
      where: { id },
      data: {
        ...body,
        startsAt: body.startsAt ? new Date(body.startsAt) : undefined,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
      },
    })
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.prisma.banner.delete({ where: { id } })
    return { deleted: true }
  }
}
