import { BadRequestException } from '@nestjs/common'
import type { Coupon } from '@prisma/client'
import type { PrismaService } from '../../common/prisma.service'

export type CouponValidateResponse =
  | { valid: false; discount: 0; freeShipping: false; message: string }
  | {
      valid: true
      couponId: string
      code: string
      type: 'free_shipping' | 'percent' | 'fixed'
      discount: number
      freeShipping: boolean
      message: string
    }

function computeDiscount(
  coupon: Coupon,
  subtotal: number,
): {
  type: 'free_shipping' | 'percent' | 'fixed'
  discount: number
  freeShipping: boolean
  message: string
} {
  if (coupon.type === 'FREE_SHIPPING') {
    return {
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
      type: 'percent',
      discount,
      freeShipping: false,
      message: `${Number(coupon.value)}% off applied`,
    }
  }

  const discount = Math.min(Number(coupon.value), subtotal)
  return {
    type: 'fixed',
    discount,
    freeShipping: false,
    message: `BDT ${discount.toLocaleString('en-BD')} off applied`,
  }
}

export function validateCouponRow(
  coupon: Coupon | null,
  subtotal: number,
  now = new Date(),
): CouponValidateResponse {
  if (!coupon) {
    return { valid: false, discount: 0, freeShipping: false, message: 'Invalid coupon code' }
  }

  if (coupon.startsAt && coupon.startsAt > now) {
    return { valid: false, discount: 0, freeShipping: false, message: 'Coupon not active yet' }
  }
  if (coupon.expiresAt && coupon.expiresAt < now) {
    return { valid: false, discount: 0, freeShipping: false, message: 'Coupon expired' }
  }
  if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) {
    return { valid: false, discount: 0, freeShipping: false, message: 'Coupon usage limit reached' }
  }

  const minOrder = coupon.minOrderAmount ? Number(coupon.minOrderAmount) : 0
  if (minOrder && subtotal < minOrder) {
    return {
      valid: false,
      discount: 0,
      freeShipping: false,
      message: `Minimum order BDT ${minOrder.toLocaleString('en-BD')} required`,
    }
  }

  const computed = computeDiscount(coupon, subtotal)
  return {
    valid: true,
    couponId: coupon.id,
    code: coupon.code,
    ...computed,
  }
}

export async function findActiveCoupon(
  prisma: PrismaService,
  storeId: string,
  code: string,
): Promise<Coupon | null> {
  const normalized = code.trim().toUpperCase()
  if (!normalized) return null
  return prisma.coupon.findFirst({
    where: { storeId, code: normalized, isActive: true },
  })
}

export async function validateStorefrontCoupon(
  prisma: PrismaService,
  storeId: string,
  code: string,
  subtotal: number,
): Promise<CouponValidateResponse> {
  const coupon = await findActiveCoupon(prisma, storeId, code)
  return validateCouponRow(coupon, subtotal)
}

/** Throws when coupon cannot be applied — used during order create. */
export async function assertCouponForOrder(
  prisma: PrismaService,
  storeId: string,
  code: string,
  subtotal: number,
): Promise<{ couponId: string; discount: number; freeShipping: boolean }> {
  const result = await validateStorefrontCoupon(prisma, storeId, code, subtotal)
  if (!result.valid) {
    throw new BadRequestException(result.message)
  }
  return {
    couponId: result.couponId,
    discount: result.discount,
    freeShipping: result.freeShipping,
  }
}
