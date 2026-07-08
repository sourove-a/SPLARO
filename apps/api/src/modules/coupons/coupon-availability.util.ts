import type { PrismaService } from '../../common/prisma.service'
import { resolveStoreId } from '../../common/store.util'

type CouponRow = {
  id: string
  code: string
  usageLimit: number | null
  usedCount: number
  startsAt: Date | null
  expiresAt: Date | null
}

/** Admin-created coupons that are eligible for storefront checkout right now. */
export function filterEligibleCoupons(coupons: CouponRow[], now = new Date()): CouponRow[] {
  return coupons.filter((coupon) => {
    if (coupon.startsAt && coupon.startsAt > now) return false
    if (coupon.expiresAt && coupon.expiresAt < now) return false
    if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) return false
    return true
  })
}

export async function countEligibleStorefrontCoupons(
  prisma: PrismaService,
  storeId: string,
): Promise<number> {
  const sid = await resolveStoreId(prisma, storeId)
  const coupons = await prisma.coupon.findMany({
    where: { storeId: sid, isActive: true },
    select: {
      id: true,
      code: true,
      usageLimit: true,
      usedCount: true,
      startsAt: true,
      expiresAt: true,
    },
  })
  return filterEligibleCoupons(coupons).length
}
