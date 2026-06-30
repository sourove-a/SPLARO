import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query } from '@nestjs/common'
import type { RMAStatus, RMAType } from '@prisma/client'
import { PrismaService } from '../../common/prisma.service'
import { resolveStoreId } from '../../common/store.util'
import { RmaService } from './rma.service'

@Controller('admin/rma')
export class RmaController {
  constructor(
    private readonly rma: RmaService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  @Get()
  list(
    @Query('storeId') storeId?: string,
    @Query('search') search?: string,
    @Query('status') status?: RMAStatus,
    @Query('type') type?: RMAType,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.rma.list(storeId, search)
  }

  @Get('stats')
  async stats(@Query('storeId') storeId: string) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const [byStatus, byType, recentActivity] = await Promise.all([
      this.prisma.rMA.groupBy({
        by: ['status'],
        where: { storeId: sid },
        _count: true,
      }),
      this.prisma.rMA.groupBy({
        by: ['type'],
        where: { storeId: sid },
        _count: true,
      }),
      this.prisma.rMA.findMany({
        where: { storeId: sid },
        orderBy: { updatedAt: 'desc' },
        take: 5,
        select: {
          id: true,
          rmaNumber: true,
          type: true,
          status: true,
          reason: true,
          updatedAt: true,
          order: { select: { invoiceNumber: true, shippingName: true } },
        },
      }),
    ])

    return { byStatus, byType, recentActivity }
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    return this.prisma.rMA.findUnique({
      where: { id },
      include: {
        order: {
          select: {
            invoiceNumber: true,
            shippingName: true,
            shippingPhone: true,
            total: true,
            paymentMethod: true,
            createdAt: true,
          },
        },
        customer: { select: { firstName: true, lastName: true, phone: true, email: true } },
        items: {
          include: {
            orderItem: { select: { productName: true, variantName: true, quantity: true, price: true } },
          },
        },
        statusHistory: { orderBy: { createdAt: 'desc' } },
      },
    })
  }

  @Post()
  create(
    @Query('storeId') storeId: string,
    @Body()
    body: {
      orderId: string
      type?: RMAType
      reason: string
      description?: string
      customerId?: string
    },
  ) {
    return this.rma.create(storeId, body)
  }

  @Patch(':id/status')
  updateStatus(
    @Query('storeId') storeId: string,
    @Param('id') id: string,
    @Body() body: { status: RMAStatus; note?: string; refundAmount?: number },
  ) {
    return this.rma.updateStatus(storeId, id, body)
  }

  @Patch(':id/notes')
  async updateNotes(
    @Param('id') id: string,
    @Body('adminNotes') adminNotes: string,
  ) {
    return this.prisma.rMA.update({
      where: { id },
      data: { adminNotes },
    })
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    await this.prisma.rMA.delete({ where: { id } })
    return { deleted: id }
  }
}
