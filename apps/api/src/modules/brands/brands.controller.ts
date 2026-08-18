import { Body, Controller, Get, Patch, Post, Param, Query } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'
import { resolveStoreId, slugify } from '../../common/store.util'
import { ensureJhingephoolBrand, ensureSplaroBrand } from '../collections/jhingephool.util'

@Controller('admin/brands')
export class BrandsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Query('storeId') storeId: string) {
    const sid = await resolveStoreId(this.prisma, storeId)
    await ensureJhingephoolBrand(this.prisma, sid)
    await ensureSplaroBrand(this.prisma, sid)
    let brands = await this.prisma.brand.findMany({
      where: { storeId: sid },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    })

    if (brands.length === 0) {
      const store = await this.prisma.store.findUnique({ where: { id: sid }, select: { name: true } })
      const defaultName = store?.name ?? 'SPLARO'
      await this.prisma.brand.create({
        data: {
          storeId: sid,
          name: defaultName,
          slug: slugify(defaultName),
          vendorLabel: 'In-house',
          country: 'Bangladesh',
          isActive: true,
        },
      })
      brands = await this.prisma.brand.findMany({
        where: { storeId: sid },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      })
    }

    // Real counts. This used to report every product in the store against
    // whichever brand was named "splaro" and 0 for the rest, because products
    // had no brand column to count by.
    const grouped = await this.prisma.product.groupBy({
      by: ['brandId'],
      where: { storeId: sid, brandId: { not: null } },
      _count: { _all: true },
    })
    const counts = new Map(grouped.map((row) => [row.brandId, row._count._all]))

    return {
      brands: brands.map((b) => ({
        ...b,
        productCount: counts.get(b.id) ?? 0,
      })),
      total: brands.length,
    }
  }

  @Post()
  async create(
    @Query('storeId') storeId: string,
    @Body()
    body: {
      name: string
      vendorLabel?: string
      country?: string
      logo?: string
    },
  ) {
    const sid = await resolveStoreId(this.prisma, storeId)
    let slug = slugify(body.name)
    const existing = await this.prisma.brand.findUnique({
      where: { storeId_slug: { storeId: sid, slug } },
    })
    if (existing) slug = `${slug}-${Date.now().toString(36)}`

    return this.prisma.brand.create({
      data: {
        storeId: sid,
        name: body.name,
        slug,
        vendorLabel: body.vendorLabel,
        country: body.country ?? 'Bangladesh',
        logo: body.logo,
        isActive: true,
      },
    })
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Query('storeId') storeId: string,
    @Body()
    body: {
      name?: string
      vendorLabel?: string
      country?: string
      logo?: string
      isActive?: boolean
    },
  ) {
    const sid = await resolveStoreId(this.prisma, storeId)
    return this.prisma.brand.update({
      where: { id, storeId: sid },
      data: body,
    })
  }
}
