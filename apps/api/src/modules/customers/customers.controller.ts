import { Controller, Get, Post, Patch, Delete, Param, Query, Body, NotFoundException, BadRequestException, Inject } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'
import { deleteOrderWithRelations } from '../../common/order-cleanup'
import { resolveStoreId } from '../../common/store.util'
import { LoyaltyService } from '../loyalty/loyalty.service'
import type { LoyaltyTier, Prisma } from '@prisma/client'

@Controller('admin/customers')
export class CustomersController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(LoyaltyService) private readonly loyalty: LoyaltyService,
  ) {}

  private sid(raw?: string) {
    return resolveStoreId(this.prisma, raw)
  }

  @Get()
  async list(
    @Query('storeId') storeId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('search') search?: string,
    @Query('tier') tier?: string,
  ) {
    const sid = await this.sid(storeId)
    const skip = (Number(page) - 1) * Number(limit)
    const where: Prisma.CustomerWhereInput = {
      storeId: sid,
      ...(tier ? { loyaltyTier: tier as LoyaltyTier } : {}),
      ...(search ? {
        OR: [
          { phone: { contains: search } },
          { firstName: { contains: search, mode: 'insensitive' as const } },
          { lastName: { contains: search, mode: 'insensitive' as const } },
          { email: { contains: search, mode: 'insensitive' as const } },
        ],
      } : {}),
    }

    const [rows, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        select: {
          id: true, firstName: true, lastName: true, phone: true, email: true,
          loyaltyTier: true, loyaltyPoints: true, totalOrders: true, totalSpent: true,
          codRiskScore: true, tags: true, createdAt: true, lastOrderDate: true,
          user: { select: { isActive: true } },
        },
        orderBy: { totalSpent: 'desc' },
        skip,
        take: Number(limit),
      }),
      this.prisma.customer.count({ where }),
    ])

    const customers = rows.map(({ user, ...c }) => ({
      ...c,
      isBlocked: user ? !user.isActive : false,
    }))

    return { customers, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) }
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        addresses: true,
        orders: {
          orderBy: { createdAt: 'desc' },
          take: 50,
          select: {
            id: true,
            invoiceNumber: true,
            total: true,
            status: true,
            paymentMethod: true,
            createdAt: true,
          },
        },
        customerNotes: { orderBy: { createdAt: 'desc' } },
        user: { select: { isActive: true } },
      },
    })
    if (!customer) throw new NotFoundException('Customer not found')
    const { user, ...rest } = customer
    return { ...rest, isBlocked: user ? !user.isActive : false }
  }

  @Post(':id/notes')
  async addNote(@Param('id') id: string, @Body() body: { content: string; createdBy: string }) {
    return this.prisma.customerNote.create({
      data: { customerId: id, body: body.content, isPrivate: true, authorId: body.createdBy },
    })
  }

  @Patch(':id/tags')
  async updateTags(@Param('id') id: string, @Body() body: { tags: string[] }) {
    return this.prisma.customer.update({ where: { id }, data: { tags: body.tags } })
  }

  @Get(':id/loyalty')
  async getLoyaltySummary(@Param('id') id: string) {
    return this.loyalty.getLoyaltySummary(id)
  }

  @Post(':id/loyalty/points')
  async awardPoints(@Param('id') id: string, @Body() body: { points: number; reason: string }) {
    await this.prisma.$transaction([
      this.prisma.customer.update({ where: { id }, data: { loyaltyPoints: { increment: body.points } } }),
      this.prisma.loyaltyHistory.create({ data: { customerId: id, points: body.points, type: 'BONUS', reason: body.reason } }),
    ])
    return { success: true }
  }

  @Patch(':id/block')
  async blockCustomer(@Param('id') id: string, @Body() body: { blocked: boolean }) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      select: { userId: true },
    })
    if (!customer) throw new NotFoundException('Customer not found')

    await this.prisma.user.update({
      where: { id: customer.userId },
      data: { isActive: !body.blocked },
    })

    return { success: true, blocked: body.blocked }
  }

  /* ─── Bulk operations ──────────────────────────────────────── */

  @Post('bulk/block')
  async bulkBlock(@Body() body: { customerIds: string[]; blocked: boolean }) {
    const results = await Promise.all(
      body.customerIds.map(async (id) => {
        try {
          const customer = await this.prisma.customer.findUnique({
            where: { id },
            select: { userId: true },
          })
          if (!customer) return { id, success: false, error: 'Not found' }
          await this.prisma.user.update({
            where: { id: customer.userId },
            data: { isActive: !body.blocked },
          })
          return { id, success: true }
        } catch (err) {
          return { id, success: false, error: err instanceof Error ? err.message : 'Failed' }
        }
      }),
    )
    return { results, updated: results.filter((r) => r.success).length }
  }

  @Post('bulk/tags')
  async bulkAddTags(@Body() body: { customerIds: string[]; tags: string[] }) {
    await this.prisma.customer.updateMany({
      where: { id: { in: body.customerIds } },
      data: { tags: { push: body.tags } },
    })
    return { ok: true, updated: body.customerIds.length }
  }

  /** Export customers CSV */
  @Get('export')
  async exportCsv(@Query('storeId') storeId: string, @Query('tier') tier?: string) {
    const sid = await this.sid(storeId)
    const customers = await this.prisma.customer.findMany({
      where: { storeId: sid, ...(tier ? { loyaltyTier: tier as import('@prisma/client').LoyaltyTier } : {}) },
      select: {
        firstName: true, lastName: true, phone: true, email: true,
        loyaltyTier: true, loyaltyPoints: true, totalOrders: true, totalSpent: true,
        createdAt: true,
      },
      orderBy: { totalSpent: 'desc' },
      take: 5000,
    })

    const header = 'First Name,Last Name,Phone,Email,Tier,Points,Orders,Spent,Joined'
    const rows = customers.map((c) =>
      [c.firstName, c.lastName, c.phone, c.email ?? '', c.loyaltyTier, c.loyaltyPoints, c.totalOrders, Number(c.totalSpent), c.createdAt.toISOString()].join(','),
    )
    return [header, ...rows].join('\n')
  }

  /** COD risk overview */
  @Get('cod-risk/stats')
  async codRiskStats(@Query('storeId') storeId: string) {
    const sid = await this.sid(storeId)
    const [highRisk, medium, total] = await Promise.all([
      this.prisma.customer.count({ where: { storeId: sid, codRiskScore: { gte: 70 } } }),
      this.prisma.customer.count({ where: { storeId: sid, codRiskScore: { gte: 40, lt: 70 } } }),
      this.prisma.customer.count({ where: { storeId: sid } }),
    ])
    return { total, highRisk, medium, low: total - highRisk - medium }
  }

  /** Get wishlist for a customer */
  @Get(':id/wishlist')
  async getWishlist(@Param('id') id: string) {
    return this.prisma.wishlist.findFirst({
      where: { customerId: id },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    })
  }

  /** Get addresses for a customer */
  @Get(':id/addresses')
  async getAddresses(@Param('id') id: string) {
    return this.prisma.address.findMany({ where: { customerId: id } })
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Query('force') force?: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      select: { userId: true, totalOrders: true },
    })
    if (!customer) throw new NotFoundException('Customer not found')
    if (customer.totalOrders > 0 && force !== 'true') {
      throw new BadRequestException('Delete orders first, or use force delete from admin.')
    }

    await this.prisma.$transaction(async (tx) => {
      if (force === 'true') {
        const orders = await tx.order.findMany({
          where: { customerId: id },
          select: { id: true },
        })
        for (const order of orders) {
          await deleteOrderWithRelations(tx, order.id)
        }
      }

      await tx.loyaltyHistory.deleteMany({ where: { customerId: id } })
      await tx.customerNote.deleteMany({ where: { customerId: id } })
      await tx.address.deleteMany({ where: { customerId: id } })
      await tx.wishlist.deleteMany({ where: { customerId: id } })
      await tx.cartSession.deleteMany({ where: { customerId: id } })
      await tx.customer.delete({ where: { id } })
      await tx.user.delete({ where: { id: customer.userId } })
    })

    return { success: true }
  }
}
