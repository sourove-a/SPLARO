import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { PrismaService } from '../../common/prisma.service'
import { resolveStoreId } from '../../common/store.util'
import { Public } from '../../common/auth/public.decorator'
import type { CouponType } from '@prisma/client'
import { countEligibleStorefrontCoupons, filterEligibleCoupons } from './coupon-availability.util'
import { validateStorefrontCoupon } from './coupon-validate.util'

@Controller('admin/coupons')
export class CouponsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Query('storeId') storeId: string) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const coupons = await this.prisma.coupon.findMany({
      where: { storeId: sid },
      orderBy: { createdAt: 'desc' },
    })
    return { coupons, total: coupons.length }
  }

  @Post()
  async create(
    @Query('storeId') storeId: string,
    @Body()
    body: {
      code: string
      type: CouponType
      value: number
      minOrderAmount?: number
      maxDiscountAmount?: number
      usageLimit?: number
      isActive?: boolean
      startsAt?: string
      expiresAt?: string
    },
  ) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const coupon = await this.prisma.coupon.create({
      data: {
        storeId: sid,
        code: body.code.trim().toUpperCase(),
        type: body.type,
        value: body.value,
        minOrderAmount: body.minOrderAmount ?? null,
        maxDiscountAmount: body.maxDiscountAmount ?? null,
        usageLimit: body.usageLimit ?? null,
        isActive: body.isActive ?? true,
        startsAt: body.startsAt ? new Date(body.startsAt) : null,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      },
    })
    return { coupon }
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body()
    body: {
      code?: string
      type?: CouponType
      value?: number
      minOrderAmount?: number | null
      maxDiscountAmount?: number | null
      usageLimit?: number | null
      isActive?: boolean
      startsAt?: string | null
      expiresAt?: string | null
    },
  ) {
    const coupon = await this.prisma.coupon.update({
      where: { id },
      data: {
        ...(body.code !== undefined ? { code: body.code.trim().toUpperCase() } : {}),
        ...(body.type !== undefined ? { type: body.type } : {}),
        ...(body.value !== undefined ? { value: body.value } : {}),
        ...(body.minOrderAmount !== undefined ? { minOrderAmount: body.minOrderAmount } : {}),
        ...(body.maxDiscountAmount !== undefined ? { maxDiscountAmount: body.maxDiscountAmount } : {}),
        ...(body.usageLimit !== undefined ? { usageLimit: body.usageLimit } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
        ...(body.startsAt !== undefined ? { startsAt: body.startsAt ? new Date(body.startsAt) : null } : {}),
        ...(body.expiresAt !== undefined ? { expiresAt: body.expiresAt ? new Date(body.expiresAt) : null } : {}),
      },
    })
    return { coupon }
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.prisma.coupon.delete({ where: { id } })
    return { success: true }
  }
}

@Public()
@Controller('storefront/coupons')
export class StorefrontCouponsController {
  constructor(private readonly prisma: PrismaService) {}

  private async listEligibleCodes(storeId: string) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const now = new Date()
    const coupons = await this.prisma.coupon.findMany({
      where: { storeId: sid, isActive: true },
      select: { id: true, code: true, usageLimit: true, usedCount: true, startsAt: true, expiresAt: true },
    })
    const available = filterEligibleCoupons(coupons, now)
    return { count: available.length, codes: available.map((c) => c.code) }
  }

  @Get('active')
  async active(@Query('storeId') storeId: string) {
    const { count, codes } = await this.listEligibleCodes(storeId)
    return { enabled: count > 0, hasActivePromo: count > 0, count, codes }
  }

  @Get('availability')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async availability(@Query('storeId') storeId: string) {
    const count = await countEligibleStorefrontCoupons(this.prisma, storeId)
    return { hasActivePromo: count > 0 }
  }

  @Post('validate')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async validate(
    @Query('storeId') storeId: string,
    @Body() body: { code: string; subtotal: number },
  ) {
    const sid = await resolveStoreId(this.prisma, storeId)
    return validateStorefrontCoupon(this.prisma, sid, body.code, Number(body.subtotal ?? 0))
  }
}

/** Alias route: GET /storefront/promos/availability */
@Public()
@Controller('storefront/promos')
export class StorefrontPromosController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('availability')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async availability(@Query('storeId') storeId: string) {
    const count = await countEligibleStorefrontCoupons(this.prisma, storeId)
    return { hasActivePromo: count > 0 }
  }
}
