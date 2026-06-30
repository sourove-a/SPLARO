import { Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Query } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'
import { resolveStoreId } from '../../common/store.util'
import type { CouponType } from '@prisma/client'

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

@Controller('storefront/coupons')
export class StorefrontCouponsController {
  constructor(private readonly prisma: PrismaService) {}

  private async countActiveCoupons(storeId: string) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const now = new Date()
    const coupons = await this.prisma.coupon.findMany({
      where: { storeId: sid, isActive: true },
      select: { id: true, code: true, usageLimit: true, usedCount: true, startsAt: true, expiresAt: true },
    })
    const available = coupons.filter((c) => {
      if (c.startsAt && c.startsAt > now) return false
      if (c.expiresAt && c.expiresAt < now) return false
      if (c.usageLimit && c.usedCount >= c.usageLimit) return false
      return true
    })
    return { count: available.length, codes: available.map((c) => c.code) }
  }

  @Get('active')
  async active(@Query('storeId') storeId: string) {
    const { count, codes } = await this.countActiveCoupons(storeId)
    return { enabled: count > 0, count, codes }
  }

  @Post('validate')
  async validate(
    @Query('storeId') storeId: string,
    @Body() body: { code: string; subtotal: number },
  ) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const normalized = body.code.trim().toUpperCase()
    const coupon = await this.prisma.coupon.findFirst({
      where: { storeId: sid, code: normalized, isActive: true },
    })

    if (!coupon) {
      return { valid: false, discount: 0, freeShipping: false, message: 'Invalid coupon code' }
    }

    const now = new Date()
    if (coupon.startsAt && coupon.startsAt > now) {
      return { valid: false, discount: 0, freeShipping: false, message: 'Coupon not active yet' }
    }
    if (coupon.expiresAt && coupon.expiresAt < now) {
      return { valid: false, discount: 0, freeShipping: false, message: 'Coupon expired' }
    }
    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
      return { valid: false, discount: 0, freeShipping: false, message: 'Coupon usage limit reached' }
    }

    const subtotal = body.subtotal
    const minOrder = coupon.minOrderAmount ? Number(coupon.minOrderAmount) : 0
    if (minOrder && subtotal < minOrder) {
      return {
        valid: false,
        discount: 0,
        freeShipping: false,
        message: `Minimum order BDT ${minOrder.toLocaleString('en-BD')} required`,
      }
    }

    if (coupon.type === 'FREE_SHIPPING') {
      return {
        valid: true,
        code: coupon.code,
        type: 'free_shipping',
        discount: 0,
        freeShipping: true,
        message: 'Free shipping applied',
      }
    }

    if (coupon.type === 'PERCENTAGE') {
      const raw = Math.round(subtotal * (Number(coupon.value) / 100))
      const max = coupon.maxDiscountAmount ? Number(coupon.maxDiscountAmount) : raw
      const discount = Math.min(raw, max)
      return {
        valid: true,
        code: coupon.code,
        type: 'percent',
        discount,
        freeShipping: false,
        message: `${Number(coupon.value)}% off applied`,
      }
    }

    const discount = Math.min(Number(coupon.value), subtotal)
    return {
      valid: true,
      code: coupon.code,
      type: 'fixed',
      discount,
      freeShipping: false,
      message: `BDT ${discount.toLocaleString('en-BD')} off applied`,
    }
  }
}
