import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common'
import { SaasService } from './saas.service'
import { PrismaService } from '../../common/prisma.service'
import { resolveStoreId } from '../../common/store.util'

@Controller('admin/saas')
export class SaasController {
  constructor(
    private readonly saas: SaasService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  /** SaaS platform overview */
  @Get()
  overview(@Query('storeId') storeId: string) {
    return this.saas.overview(storeId)
  }

  /* ─── Subscription management ─────────────────────────────── */

  /** Get current subscription */
  @Get('subscription')
  async getSubscription(@Query('storeId') storeId: string) {
    const sid = await resolveStoreId(this.prisma, storeId)
    return this.prisma.subscription.findUnique({
      where: { storeId: sid },
    })
  }

  /** Update subscription plan */
  @Patch('subscription')
  async updateSubscription(
    @Query('storeId') storeId: string,
    @Body()
    body: {
      plan?: string
      status?: string
      cancelAtPeriodEnd?: boolean
      currentPeriodEnd?: string
    },
  ) {
    const sid = await resolveStoreId(this.prisma, storeId)

    return this.prisma.subscription.upsert({
      where: { storeId: sid },
      update: {
        ...(body.plan !== undefined ? { plan: body.plan as 'FREE' | 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE' } : {}),
        ...(body.status !== undefined ? { status: body.status as 'ACTIVE' | 'INACTIVE' | 'TRIALING' | 'PAST_DUE' | 'CANCELLED' } : {}),
        ...(body.cancelAtPeriodEnd !== undefined ? { cancelAtPeriodEnd: body.cancelAtPeriodEnd } : {}),
        ...(body.currentPeriodEnd ? { currentPeriodEnd: new Date(body.currentPeriodEnd) } : {}),
      },
      create: {
        storeId: sid,
        plan: (body.plan as 'FREE' | 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE') ?? 'FREE',
        status: (body.status as 'ACTIVE' | 'INACTIVE' | 'TRIALING' | 'PAST_DUE' | 'CANCELLED') ?? 'ACTIVE',
        cancelAtPeriodEnd: body.cancelAtPeriodEnd ?? false,
        currentPeriodStart: new Date(),
        currentPeriodEnd: body.currentPeriodEnd ? new Date(body.currentPeriodEnd) : new Date(Date.now() + 30 * 86400_000),
      },
    })
  }

  /* ─── All stores (platform admin) ─────────────────────────── */

  /** List all stores with subscription info */
  @Get('stores')
  async listStores(
    @Query('plan') plan?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('isActive') isActive?: string,
  ) {
    const take = Math.min(Number(limit) || 20, 100)
    const skip = (Math.max(Number(page) || 1, 1) - 1) * take

    const where: Record<string, unknown> = {}
    if (plan) where.subscriptionPlan = plan
    if (isActive !== undefined) where.isActive = isActive === 'true'
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { domain: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [stores, total] = await Promise.all([
      this.prisma.store.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          slug: true,
          domain: true,
          email: true,
          isActive: true,
          subscriptionPlan: true,
          createdAt: true,
          subscription: { select: { status: true, currentPeriodEnd: true, cancelAtPeriodEnd: true } },
          _count: { select: { orders: true, products: true, customers: true } },
        },
      }),
      this.prisma.store.count({ where }),
    ])

    return { stores, total, page: Number(page) || 1, limit: take }
  }

  /** Platform-wide stats */
  @Get('stats')
  async platformStats() {
    const [
      totalStores,
      activeStores,
      byPlan,
      totalOrders,
      totalCustomers,
      totalProducts,
    ] = await Promise.all([
      this.prisma.store.count(),
      this.prisma.store.count({ where: { isActive: true } }),
      this.prisma.store.groupBy({ by: ['subscriptionPlan'], _count: true }),
      this.prisma.order.count(),
      this.prisma.customer.count(),
      this.prisma.product.count({ where: { status: { not: 'ARCHIVED' } } }),
    ])

    return {
      totalStores,
      activeStores,
      inactiveStores: totalStores - activeStores,
      byPlan,
      platform: { totalOrders, totalCustomers, totalProducts },
    }
  }

  /** Activate or deactivate a store */
  @Patch('stores/:storeId/toggle-active')
  async toggleStoreActive(
    @Param('storeId') storeId: string,
    @Body('isActive') isActive: boolean,
  ) {
    return this.prisma.store.update({
      where: { id: storeId },
      data: { isActive },
      select: { id: true, name: true, isActive: true },
    })
  }

  /** Get single store detail (platform admin) */
  @Get('stores/:storeId')
  async getStore(@Param('storeId') storeId: string) {
    return this.prisma.store.findUnique({
      where: { id: storeId },
      include: {
        subscription: true,
        _count: {
          select: { orders: true, products: true, customers: true, staff: true },
        },
      },
    })
  }

  /* ─── Loyalty tier config ─────────────────────────────────── */

  /** Get loyalty tiers for a store */
  @Get('loyalty/tiers')
  async getLoyaltyTiers(@Query('storeId') storeId: string) {
    const sid = await resolveStoreId(this.prisma, storeId)
    return this.prisma.loyaltyTierConfig.findMany({
      where: { storeId: sid },
      orderBy: { minPoints: 'asc' },
    })
  }

  /** Upsert a loyalty tier */
  @Post('loyalty/tiers')
  async upsertLoyaltyTier(
    @Query('storeId') storeId: string,
    @Body()
    body: {
      tier: string
      minPoints: number
      pointsPerBdt?: number
      perksJson?: Record<string, unknown>
    },
  ) {
    const sid = await resolveStoreId(this.prisma, storeId)
    return this.prisma.loyaltyTierConfig.upsert({
      where: { storeId_tier: { storeId: sid, tier: body.tier as 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'DIAMOND' } },
      update: {
        minPoints: body.minPoints,
        pointsPerBdt: body.pointsPerBdt ?? 1,
        perksJson: (body.perksJson ?? {}) as object,
      },
      create: {
        storeId: sid,
        tier: body.tier as 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'DIAMOND',
        minPoints: body.minPoints,
        pointsPerBdt: body.pointsPerBdt ?? 1,
        perksJson: (body.perksJson ?? {}) as object,
      },
    })
  }

  /** Loyalty points history for a store */
  @Get('loyalty/history')
  async loyaltyHistory(
    @Query('storeId') storeId: string,
    @Query('customerId') customerId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const take = Math.min(Number(limit) || 30, 100)
    const skip = (Math.max(Number(page) || 1, 1) - 1) * take

    const where = {
      customer: { storeId: sid },
      ...(customerId ? { customerId } : {}),
    }

    const [items, total] = await Promise.all([
      this.prisma.loyaltyHistory.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          customer: { select: { firstName: true, lastName: true, phone: true } },
        },
      }),
      this.prisma.loyaltyHistory.count({ where }),
    ])

    return { items, total, page: Number(page) || 1, limit: take }
  }

  /** Manually adjust loyalty points */
  @Post('loyalty/adjust')
  async adjustPoints(
    @Body()
    body: {
      customerId: string
      points: number
      reason?: string
    },
  ) {
    const [updated, log] = await this.prisma.$transaction([
      this.prisma.customer.update({
        where: { id: body.customerId },
        data: { loyaltyPoints: { increment: body.points } },
        select: { id: true, loyaltyPoints: true },
      }),
      this.prisma.loyaltyHistory.create({
        data: {
          customerId: body.customerId,
          points: body.points,
          type: 'ADJUST',
          reason: body.reason ?? 'Manual adjustment',
        },
      }),
    ])
    return { customer: updated, log }
  }
}
