import { Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Query, Req } from '@nestjs/common'
import type { Request } from 'express'
import type { AdminSessionPayload } from '../../common/auth/admin-session.util'
import { PrismaService } from '../../common/prisma.service'
import { resolveStoreId } from '../../common/store.util'
import { LoyaltyService } from './loyalty.service'

type AdminRequest = Request & { adminUser?: AdminSessionPayload }

@Controller('admin/loyalty')
export class LoyaltyController {
  constructor(
    private readonly loyalty: LoyaltyService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('summary')
  async storeSummary(@Query('storeId') storeId: string) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const [totalCustomers, totalPoints, tiers] = await Promise.all([
      this.prisma.customer.count({ where: { storeId: sid } }),
      this.prisma.customer.aggregate({ where: { storeId: sid }, _sum: { loyaltyPoints: true } }),
      this.prisma.customer.groupBy({
        by: ['loyaltyTier'],
        where: { storeId: sid },
        _count: { id: true },
      }),
    ])
    return {
      totalCustomers,
      totalPointsIssued: totalPoints._sum.loyaltyPoints ?? 0,
      tierBreakdown: tiers.map((t) => ({ tier: t.loyaltyTier, count: t._count.id })),
    }
  }

  @Get('customers/:customerId')
  summary(@Param('customerId') customerId: string) {
    return this.loyalty.getLoyaltySummary(customerId)
  }

  @Post('customers/:customerId/award')
  async award(
    @Param('customerId') customerId: string,
    @Body() body: { points: number; reason: string; orderId?: string },
    @Req() req: AdminRequest,
  ) {
    if (req.adminUser?.storeId) {
      const customer = await this.prisma.customer.findUnique({
        where: { id: customerId },
        select: { storeId: true },
      })
      if (!customer || customer.storeId !== req.adminUser.storeId) {
        throw new NotFoundException('Customer not found')
      }
    }

    const newTotal = await this.prisma.$transaction(async (tx) => {
      await tx.loyaltyHistory.create({
        data: {
          customerId,
          points: body.points,
          type: 'EARN',
          reason: body.reason,
          ...(body.orderId ? { orderId: body.orderId } : {}),
        },
      })
      const updated = await tx.customer.update({
        where: { id: customerId },
        data: { loyaltyPoints: { increment: body.points } },
        select: { loyaltyPoints: true, storeId: true },
      })
      return updated
    })

    const newTier = await this.loyalty.getTierForPoints(newTotal.storeId, newTotal.loyaltyPoints)
    await this.prisma.customer.update({ where: { id: customerId }, data: { loyaltyTier: newTier } })

    return { loyaltyPoints: newTotal.loyaltyPoints, tier: newTier }
  }

  @Post('customers/:customerId/redeem')
  redeem(
    @Param('customerId') customerId: string,
    @Body() body: { points: number; orderId: string },
  ) {
    return this.loyalty.redeemPoints(customerId, body.points, body.orderId)
  }

  @Get('tiers')
  async getTiers(@Query('storeId') storeId: string) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const configs = await this.prisma.loyaltyTierConfig.findMany({
      where: { storeId: sid },
      orderBy: { minPoints: 'asc' },
    })
    return { tiers: configs }
  }

  @Post('tiers')
  async upsertTier(
    @Query('storeId') storeId: string,
    @Body() body: { tier: string; minPoints: number; pointsPerBdt: number; perks?: string[] },
  ) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const perksJson = JSON.parse(JSON.stringify({ perks: body.perks ?? [] })) as object
    return this.prisma.loyaltyTierConfig.upsert({
      where: { storeId_tier: { storeId: sid, tier: body.tier as never } },
      create: {
        storeId: sid,
        tier: body.tier as never,
        minPoints: body.minPoints,
        pointsPerBdt: body.pointsPerBdt,
        perksJson,
      },
      update: {
        minPoints: body.minPoints,
        pointsPerBdt: body.pointsPerBdt,
        perksJson,
      },
    })
  }

  @Get('history')
  async history(@Query('storeId') storeId: string, @Query('customerId') customerId?: string) {
    const sid = await resolveStoreId(this.prisma, storeId)
    return this.prisma.loyaltyHistory.findMany({
      where: {
        ...(customerId ? { customerId } : { customer: { storeId: sid } }),
      },
      include: { customer: { select: { firstName: true, lastName: true, phone: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
  }

  @Post('run-birthday-awards')
  async runBirthdayAwards(@Query('storeId') storeId: string) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const awarded = await this.loyalty.awardBirthdayPoints(sid)
    return { awarded }
  }

  /* ─── Bulk award ──────────────────────────────────────────── */

  @Post('bulk/award')
  async bulkAward(
    @Body()
    body: {
      customerIds: string[]
      points: number
      reason: string
    },
  ) {
    const results = await Promise.all(
      body.customerIds.map(async (customerId) => {
        try {
          await this.prisma.$transaction([
            this.prisma.customer.update({
              where: { id: customerId },
              data: { loyaltyPoints: { increment: body.points } },
            }),
            this.prisma.loyaltyHistory.create({
              data: { customerId, points: body.points, type: 'EARN', reason: body.reason },
            }),
          ])
          return { customerId, success: true }
        } catch {
          return { customerId, success: false }
        }
      }),
    )
    return { results, awarded: results.filter((r) => r.success).length }
  }

  /** Expire points older than N days */
  @Post('expire-points')
  async expirePoints(@Query('storeId') storeId: string, @Body('olderThanDays') days: number) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const before = new Date()
    before.setDate(before.getDate() - (days ?? 365))

    const expiring = await this.prisma.loyaltyHistory.findMany({
      where: {
        customer: { storeId: sid },
        type: 'EARN',
        expireAt: { lte: new Date() },
        createdAt: { lte: before },
      },
      select: { customerId: true, points: true },
    })

    let expired = 0
    for (const entry of expiring) {
      await this.prisma.$transaction([
        this.prisma.customer.update({
          where: { id: entry.customerId },
          data: { loyaltyPoints: { decrement: entry.points } },
        }),
        this.prisma.loyaltyHistory.create({
          data: {
            customerId: entry.customerId,
            points: -entry.points,
            type: 'EXPIRE',
            reason: 'Points expired',
          },
        }),
      ])
      expired++
    }

    return { expired }
  }

  /* ─── Tier analytics ──────────────────────────────────────── */

  @Get('tier-analytics')
  async tierAnalytics(@Query('storeId') storeId: string, @Query('days') days?: string) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const since = new Date()
    since.setDate(since.getDate() - (Number(days) || 30))

    const [tierDistribution, recentUpgrades, pointsIssued, pointsRedeemed] = await Promise.all([
      this.prisma.customer.groupBy({
        by: ['loyaltyTier'],
        where: { storeId: sid },
        _count: true,
        _sum: { loyaltyPoints: true, totalSpent: true },
      }),
      this.prisma.loyaltyHistory.count({
        where: { customer: { storeId: sid }, type: 'TIER_UPGRADE', createdAt: { gte: since } },
      }),
      this.prisma.loyaltyHistory.aggregate({
        where: { customer: { storeId: sid }, type: 'EARN', createdAt: { gte: since } },
        _sum: { points: true },
        _count: true,
      }),
      this.prisma.loyaltyHistory.aggregate({
        where: { customer: { storeId: sid }, type: 'REDEEM', createdAt: { gte: since } },
        _sum: { points: true },
        _count: true,
      }),
    ])

    return {
      period: `${Number(days) || 30}d`,
      tierDistribution,
      recentUpgrades,
      pointsIssued: pointsIssued._sum.points ?? 0,
      issueEvents: pointsIssued._count,
      pointsRedeemed: Math.abs(pointsRedeemed._sum.points ?? 0),
      redeemEvents: pointsRedeemed._count,
    }
  }

  /* ─── Referrals ───────────────────────────────────────────── */

  @Get('referrals')
  async listReferrals(
    @Query('storeId') storeId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('converted') converted?: string,
  ) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const take = Math.min(Number(limit) || 30, 100)
    const skip = (Math.max(Number(page) || 1, 1) - 1) * take

    const where = {
      referrer: { storeId: sid },
      ...(converted !== undefined ? { isConverted: converted === 'true' } : {}),
    }

    const [items, total] = await Promise.all([
      this.prisma.referral.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          referrer: { select: { firstName: true, lastName: true, phone: true } },
        },
      }),
      this.prisma.referral.count({ where }),
    ])

    return { items, total, page: Number(page) || 1, limit: take }
  }

  @Get('referrals/stats')
  async referralStats(@Query('storeId') storeId: string) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const [total, converted, totalPoints] = await Promise.all([
      this.prisma.referral.count({ where: { referrer: { storeId: sid } } }),
      this.prisma.referral.count({ where: { referrer: { storeId: sid }, isConverted: true } }),
      this.prisma.referral.aggregate({
        where: { referrer: { storeId: sid }, isConverted: true },
        _sum: { rewardPoints: true },
      }),
    ])

    return {
      total,
      converted,
      conversionRate: total > 0 ? Math.round((converted / total) * 100) : 0,
      totalRewardPoints: totalPoints._sum.rewardPoints ?? 0,
    }
  }

  @Get('referrals/customer/:customerId')
  async customerReferrals(@Param('customerId') customerId: string) {
    return this.prisma.referral.findMany({
      where: { referrerId: customerId },
      orderBy: { createdAt: 'desc' },
    })
  }

  @Delete('referrals/:id')
  async deleteReferral(@Param('id') id: string, @Req() req: AdminRequest) {
    const referral = await this.prisma.referral.findUnique({
      where: { id },
      select: { referrer: { select: { storeId: true } } },
    })
    if (!referral) throw new NotFoundException('Referral not found')
    if (req.adminUser?.storeId && referral.referrer.storeId !== req.adminUser.storeId) {
      throw new NotFoundException('Referral not found')
    }

    await this.prisma.referral.delete({ where: { id } })
    return { deleted: id }
  }
}
