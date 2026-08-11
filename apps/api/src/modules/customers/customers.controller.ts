import { Controller, Get, Post, Patch, Delete, Param, Query, Body, NotFoundException, BadRequestException, Inject } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'
import { deleteOrderWithRelations } from '../../common/order-cleanup'
import { buildCustomerLookupWhere } from '../../common/customer-code.util'
import { resolveStoreId } from '../../common/store.util'
import { resolveAdminPagination } from '../../common/admin-pagination.util'
import { LoyaltyService } from '../loyalty/loyalty.service'
import { CustomersService } from './customers.service'
import type { LoyaltyTier, Prisma } from '@prisma/client'
import {
  buildFraudFlags,
  FRAUD_SIGNAL_WINDOW_DAYS,
  isPrivateOrLoopbackIp,
  maskDeviceId,
  summarizeUserAgent,
  type CustomerFraudSignals,
} from './customer-fraud-signals'

/**
 * Purging one customer walks every order they ever placed, and each order drags
 * ~15 dependent tables with it. Prisma's 5s interactive-transaction default
 * times out on a long-standing account, which would surface as a bogus
 * "delete failed" against a perfectly valid record.
 */
const PURGE_TX_OPTIONS = { maxWait: 10_000, timeout: 120_000 } as const

@Controller('admin/customers')
export class CustomersController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(LoyaltyService) private readonly loyalty: LoyaltyService,
    @Inject(CustomersService) private readonly customersService: CustomersService,
  ) {}

  private sid(raw?: string) {
    return resolveStoreId(this.prisma, raw)
  }

  /** Load a customer scoped to the caller's store — id or SPL-C-######. */
  private async ownedCustomer(idOrCode: string, storeId?: string, select?: Prisma.CustomerSelect) {
    const sid = await this.sid(storeId)
    const customer = await this.prisma.customer.findFirst({
      where: buildCustomerLookupWhere(idOrCode, sid),
      ...(select ? { select } : {}),
    })
    if (!customer) throw new NotFoundException('Customer not found')
    return customer
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
    const { page: pageNum, limit: take, skip } = resolveAdminPagination(page, limit)
    const where: Prisma.CustomerWhereInput = {
      storeId: sid,
      ...(tier ? { loyaltyTier: tier as LoyaltyTier } : {}),
      ...(search ? {
        OR: [
          { phone: { contains: search } },
          { customerCode: { contains: search, mode: 'insensitive' as const } },
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
          id: true, customerCode: true, firstName: true, lastName: true, phone: true, email: true,
          loyaltyTier: true, loyaltyPoints: true, totalOrders: true, totalSpent: true,
          codRiskScore: true, tags: true, createdAt: true, lastOrderDate: true,
          user: {
            select: {
              isActive: true,
              authProvider: true,
              googleId: true,
              emailVerified: true,
              avatar: true,
            },
          },
        },
        orderBy: { totalSpent: 'desc' },
        skip,
        take,
      }),
      this.prisma.customer.count({ where }),
    ])

    const customers = rows.map(({ user, ...c }) => ({
      ...c,
      isBlocked: user ? !user.isActive : false,
      authProvider: user?.authProvider ?? 'password',
      googleLinked: Boolean(user?.googleId),
      emailVerified: user?.emailVerified ?? false,
      ...(user?.avatar ? { avatar: user.avatar } : {}),
    }))

    return { customers, total, page: pageNum, totalPages: Math.ceil(total / take) }
  }

  @Post()
  async create(
    @Body()
    body: {
      storeId?: string
      firstName: string
      lastName?: string
      phone: string
      email?: string
    },
  ) {
    const sid = await this.sid(body.storeId)
    return this.customersService.createFromAdmin(sid, body)
  }

  /** Export customers CSV — static segment before :id */
  @Get('export')
  async exportCsv(@Query('storeId') storeId: string, @Query('tier') tier?: string) {
    const sid = await this.sid(storeId)
    const customers = await this.prisma.customer.findMany({
      where: { storeId: sid, ...(tier ? { loyaltyTier: tier as import('@prisma/client').LoyaltyTier } : {}) },
      select: {
        customerCode: true, firstName: true, lastName: true, phone: true, email: true,
        loyaltyTier: true, loyaltyPoints: true, totalOrders: true, totalSpent: true,
        createdAt: true,
      },
      orderBy: { totalSpent: 'desc' },
      take: 5000,
    })

    const header = 'Customer Code,First Name,Last Name,Phone,Email,Tier,Points,Orders,Spent,Joined'
    const rows = customers.map((c) =>
      [c.customerCode ?? '', c.firstName, c.lastName, c.phone, c.email ?? '', c.loyaltyTier, c.loyaltyPoints, c.totalOrders, Number(c.totalSpent), c.createdAt.toISOString()].join(','),
    )
    return [header, ...rows].join('\n')
  }

  /** COD risk overview — static segment before :id */
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

  @Get(':id')
  async findOne(@Param('id') id: string, @Query('storeId') storeId?: string) {
    const sid = await this.sid(storeId)
    const customer = await this.prisma.customer.findFirst({
      where: buildCustomerLookupWhere(id, sid),
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
            clientIp: true,
            deviceId: true,
            userAgent: true,
            shippingPhone: true,
          },
        },
        customerNotes: { orderBy: { createdAt: 'desc' } },
        user: {
          select: {
            isActive: true,
            authProvider: true,
            googleId: true,
            emailVerified: true,
            avatar: true,
            lastLoginAt: true,
            lastLoginDevice: true,
            lastLoginIp: true,
          },
        },
      },
    })
    if (!customer) throw new NotFoundException('Customer not found')
    const { user, orders, ...rest } = customer

    const fraudSignals = await this.buildCustomerFraudSignals(sid, orders)

    // Strip raw device/IP from order list — keep admin review in fraudSignals only.
    const safeOrders = orders.map(
      ({ clientIp: _ip, deviceId: _did, userAgent: _ua, shippingPhone: _phone, ...order }) => order,
    )

    return {
      ...rest,
      orders: safeOrders,
      isBlocked: user ? !user.isActive : false,
      authProvider: user?.authProvider ?? 'password',
      googleLinked: Boolean(user?.googleId),
      emailVerified: user?.emailVerified ?? false,
      ...(user?.avatar ? { avatar: user.avatar } : {}),
      ...(user?.lastLoginAt ? { lastLogin: user.lastLoginAt.toISOString() } : {}),
      ...(user?.lastLoginDevice ? { lastDevice: user.lastLoginDevice } : {}),
      ...(user?.lastLoginIp ? { lastIp: user.lastLoginIp } : {}),
      fraudSignals,
    }
  }

  private async buildCustomerFraudSignals(
    storeId: string,
    orders: Array<{
      clientIp: string | null
      deviceId: string | null
      userAgent: string | null
      shippingPhone: string
      createdAt: Date
    }>,
  ): Promise<CustomerFraudSignals> {
    const withSignal = orders.filter((o) => o.clientIp || o.deviceId)
    const latest = withSignal[0] ?? null
    const lastIp = latest?.clientIp ?? null
    const lastDeviceId = latest?.deviceId ?? null
    const lastUa = latest?.userAgent ?? null

    if (!latest || (!lastIp && !lastDeviceId)) {
      return {
        lastIp: null,
        lastDeviceIdMasked: null,
        lastDeviceSummary: null,
        sameIpOrderCount: 0,
        sameDeviceOrderCount: 0,
        distinctPhonesOnDevice: 0,
        distinctPhonesOnIp: 0,
        firstSeenAt: null,
        firstSeenAtIp: null,
        firstSeenAtDevice: null,
        lastSeenAt: null,
        flags: [],
        captured: false,
      }
    }

    const windowStart = new Date()
    windowStart.setDate(windowStart.getDate() - FRAUD_SIGNAL_WINDOW_DAYS)

    const [sameIpOrderCount, sameDeviceOrderCount, phonesOnDevice, phonesOnIp, firstSeenIp, firstSeenDevice] =
      await Promise.all([
        lastIp && !isPrivateOrLoopbackIp(lastIp)
          ? this.prisma.order.count({
              where: { storeId, clientIp: lastIp, createdAt: { gte: windowStart } },
            })
          : Promise.resolve(0),
        lastDeviceId
          ? this.prisma.order.count({
              where: { storeId, deviceId: lastDeviceId, createdAt: { gte: windowStart } },
            })
          : Promise.resolve(0),
        lastDeviceId
          ? this.prisma.order.findMany({
              where: { storeId, deviceId: lastDeviceId, createdAt: { gte: windowStart } },
              select: { shippingPhone: true },
              distinct: ['shippingPhone'],
              take: 50,
            })
          : Promise.resolve([] as { shippingPhone: string }[]),
        lastIp && !isPrivateOrLoopbackIp(lastIp)
          ? this.prisma.order.findMany({
              where: { storeId, clientIp: lastIp, createdAt: { gte: windowStart } },
              select: { shippingPhone: true },
              distinct: ['shippingPhone'],
              take: 50,
            })
          : Promise.resolve([] as { shippingPhone: string }[]),
        lastIp
          ? this.prisma.order.findFirst({
              where: { storeId, clientIp: lastIp },
              orderBy: { createdAt: 'asc' },
              select: { createdAt: true },
            })
          : Promise.resolve(null),
        lastDeviceId
          ? this.prisma.order.findFirst({
              where: { storeId, deviceId: lastDeviceId },
              orderBy: { createdAt: 'asc' },
              select: { createdAt: true },
            })
          : Promise.resolve(null),
      ])

    const distinctPhonesOnDevice = phonesOnDevice.length
    const distinctPhonesOnIp = phonesOnIp.length
    const flags = buildFraudFlags({
      sameIpOrderCount,
      sameDeviceOrderCount,
      distinctPhonesOnDevice,
      distinctPhonesOnIp,
      ipIsPrivate: isPrivateOrLoopbackIp(lastIp),
    })

    const firstSeenAtIp = firstSeenIp?.createdAt.toISOString() ?? null
    const firstSeenAtDevice = firstSeenDevice?.createdAt.toISOString() ?? null
    const firstSeenCandidates = [firstSeenAtIp, firstSeenAtDevice].filter(Boolean) as string[]
    const firstSeenAt =
      firstSeenCandidates.sort()[0] ?? latest.createdAt.toISOString()

    return {
      lastIp,
      lastDeviceIdMasked: maskDeviceId(lastDeviceId),
      lastDeviceSummary: summarizeUserAgent(lastUa),
      sameIpOrderCount,
      sameDeviceOrderCount,
      distinctPhonesOnDevice,
      distinctPhonesOnIp,
      firstSeenAt,
      firstSeenAtIp,
      firstSeenAtDevice,
      lastSeenAt: latest.createdAt.toISOString(),
      flags,
      captured: true,
    }
  }

  @Post(':id/notes')
  async addNote(
    @Param('id') id: string,
    @Body() body: { content: string; createdBy: string; storeId?: string },
  ) {
    const customer = await this.ownedCustomer(id, body.storeId, { id: true })
    return this.prisma.customerNote.create({
      data: { customerId: customer.id, body: body.content, isPrivate: true, authorId: body.createdBy },
    })
  }

  @Patch(':id/tags')
  async updateTags(
    @Param('id') id: string,
    @Body() body: { tags: string[]; storeId?: string },
  ) {
    const customer = await this.ownedCustomer(id, body.storeId, { id: true })
    return this.prisma.customer.update({ where: { id: customer.id }, data: { tags: body.tags } })
  }

  @Get(':id/loyalty')
  async getLoyaltySummary(@Param('id') id: string, @Query('storeId') storeId?: string) {
    const customer = await this.ownedCustomer(id, storeId, { id: true })
    return this.loyalty.getLoyaltySummary(customer.id)
  }

  @Post(':id/loyalty/points')
  async awardPoints(
    @Param('id') id: string,
    @Body() body: { points: number; reason: string; storeId?: string },
  ) {
    const customer = await this.ownedCustomer(id, body.storeId, { id: true })
    await this.prisma.$transaction([
      this.prisma.customer.update({
        where: { id: customer.id },
        data: { loyaltyPoints: { increment: body.points } },
      }),
      this.prisma.loyaltyHistory.create({
        data: {
          customerId: customer.id,
          points: body.points,
          type: 'BONUS',
          reason: body.reason,
        },
      }),
    ])
    return { success: true }
  }

  @Patch(':id/block')
  async blockCustomer(
    @Param('id') id: string,
    @Body() body: { blocked: boolean; storeId?: string },
  ) {
    const customer = await this.ownedCustomer(id, body.storeId, { userId: true })

    await this.prisma.user.update({
      where: { id: customer.userId },
      data: { isActive: !body.blocked },
    })

    return { success: true, blocked: body.blocked }
  }

  /* ─── Bulk operations ──────────────────────────────────────── */

  @Post('bulk/block')
  async bulkBlock(@Body() body: { customerIds: string[]; blocked: boolean; storeId?: string }) {
    const sid = await this.sid(body.storeId)
    const results = await Promise.all(
      body.customerIds.map(async (id) => {
        try {
          // Store-scoped lookup — same IDOR guard as single-record ops.
          const customer = await this.prisma.customer.findFirst({
            where: { id, storeId: sid },
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
  async bulkAddTags(@Body() body: { customerIds: string[]; tags: string[]; storeId?: string }) {
    const sid = await this.sid(body.storeId)
    const customers = await this.prisma.customer.findMany({
      where: { id: { in: body.customerIds }, storeId: sid },
      select: { id: true, tags: true },
    })
    // Merge + dedupe per customer — raw `push` accumulates duplicate tags.
    await this.prisma.$transaction(
      customers.map((c) =>
        this.prisma.customer.update({
          where: { id: c.id },
          data: { tags: [...new Set([...c.tags, ...body.tags])] },
        }),
      ),
    )
    return { ok: true, updated: customers.length }
  }

  /** Get wishlist for a customer */
  @Get(':id/wishlist')
  async getWishlist(@Param('id') id: string, @Query('storeId') storeId?: string) {
    const customer = await this.ownedCustomer(id, storeId, { id: true })
    return this.prisma.wishlist.findFirst({
      where: { customerId: customer.id },
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
  async getAddresses(@Param('id') id: string, @Query('storeId') storeId?: string) {
    const customer = await this.ownedCustomer(id, storeId, { id: true })
    return this.prisma.address.findMany({ where: { customerId: customer.id } })
  }

  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @Query('force') force?: string,
    @Query('storeId') storeId?: string,
  ) {
    const customer = await this.ownedCustomer(id, storeId, { id: true, userId: true })
    const customerId = customer.id
    // Counted, not read off Customer.totalOrders — that column is denormalised
    // and a stale zero would send a customer with real orders down the
    // no-force path, straight into a raw foreign-key error.
    const orderCount = await this.prisma.order.count({ where: { customerId } })
    if (orderCount > 0 && force !== 'true') {
      throw new BadRequestException('Delete orders first, or use force delete from admin.')
    }

    const orders = await this.prisma.$transaction(
      (tx) => this.purgeCustomer(tx, customerId, customer.userId, force === 'true'),
      PURGE_TX_OPTIONS,
    )

    return { success: true, ordersDeleted: orders }
  }

  /**
   * Purge fake and duplicate accounts in one pass — the throwaway records a
   * COD scammer leaves behind, or a run of test checkouts. `force` takes their
   * orders down with them; without it a customer holding orders is skipped and
   * reported back, so a stray click can never wipe real sales history.
   */
  @Post('bulk/delete')
  async bulkRemove(
    @Body() body: { ids?: string[]; force?: boolean; storeId?: string },
  ) {
    const ids = [...new Set((body.ids ?? []).filter((id) => typeof id === 'string' && id.trim()))]
    if (ids.length === 0) throw new BadRequestException('Select at least one customer to delete.')
    if (ids.length > 100) throw new BadRequestException('Delete at most 100 customers at a time.')

    const sid = await this.sid(body.storeId)
    const customers = await this.prisma.customer.findMany({
      where: { id: { in: ids }, storeId: sid },
      select: {
        id: true,
        userId: true,
        firstName: true,
        lastName: true,
        // Counted rather than read from the denormalised totalOrders column,
        // which can lag and would wave a real customer through the no-force path.
        _count: { select: { orders: true } },
      },
    })

    const deleted: string[] = []
    const skipped: { id: string; name: string; reason: string }[] = []
    let ordersDeleted = 0

    for (const customer of customers) {
      const name = `${customer.firstName} ${customer.lastName}`.trim() || customer.id
      const orderCount = customer._count.orders
      if (orderCount > 0 && !body.force) {
        skipped.push({
          id: customer.id,
          name,
          reason: `${orderCount} order${orderCount === 1 ? '' : 's'} on file`,
        })
        continue
      }
      try {
        // One transaction per customer: a single bad record must not roll back
        // the whole sweep.
        ordersDeleted += await this.prisma.$transaction(
          (tx) => this.purgeCustomer(tx, customer.id, customer.userId, Boolean(body.force)),
          PURGE_TX_OPTIONS,
        )
        deleted.push(customer.id)
      } catch (error) {
        skipped.push({
          id: customer.id,
          name,
          reason: error instanceof Error ? error.message : 'Delete failed',
        })
      }
    }

    const missing = ids.filter((id) => !customers.some((c) => c.id === id))
    for (const id of missing) {
      skipped.push({ id, name: id, reason: 'Not found in this store' })
    }

    return { success: true, deleted: deleted.length, ordersDeleted, skipped }
  }

  /**
   * Removes a customer and everything that points at them. Every table listed
   * here holds the customer by a restricting foreign key — miss one and
   * Postgres refuses the delete. Cascading relations are deliberately absent.
   */
  private async purgeCustomer(
    tx: Prisma.TransactionClient,
    id: string,
    userId: string,
    force: boolean,
  ): Promise<number> {
    let ordersDeleted = 0
    if (force) {
      const orders = await tx.order.findMany({ where: { customerId: id }, select: { id: true } })
      for (const order of orders) {
        await deleteOrderWithRelations(tx, order.id)
        ordersDeleted += 1
      }
    }

    await tx.loyaltyHistory.deleteMany({ where: { customerId: id } })
    await tx.customerNote.deleteMany({ where: { customerId: id } })
    await tx.address.deleteMany({ where: { customerId: id } })
    await tx.wishlist.deleteMany({ where: { customerId: id } })
    await tx.cartSession.deleteMany({ where: { customerId: id } })
    await tx.review.deleteMany({ where: { customerId: id } })
    await tx.notification.deleteMany({ where: { customerId: id } })
    await tx.webPushToken.deleteMany({ where: { customerId: id } })
    await tx.referral.deleteMany({ where: { referrerId: id } })
    await tx.rMA.updateMany({ where: { customerId: id }, data: { customerId: null } })
    await tx.customer.delete({ where: { id } })

    // Audit trail outlives the account it describes — detach, never delete.
    await tx.auditLog.updateMany({ where: { userId }, data: { userId: null } })

    // The same login can also be a vendor or own a store, and both hold the
    // User by a restricting FK. Deactivate rather than delete in that case:
    // the shopper record is gone either way, and the alternative is a raw
    // foreign-key error that reads like a bug.
    const stillReferenced = await tx.user.findFirst({
      where: { id: userId, OR: [{ vendor: { isNot: null } }, { ownedStores: { some: {} } }] },
      select: { id: true },
    })
    if (stillReferenced) {
      await tx.user.update({ where: { id: userId }, data: { isActive: false } })
    } else {
      await tx.user.delete({ where: { id: userId } })
    }
    return ordersDeleted
  }
}
