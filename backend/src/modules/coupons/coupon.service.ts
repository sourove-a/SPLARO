import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';

@Injectable()
export class CouponService {
  constructor(private prisma: PrismaService) {}

  async validateAndApply(code: string, cartTotal: number) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { code, isActive: true },
    });

    if (!coupon) throw new BadRequestException('Invalid or expired coupon code');

    if (coupon.expiryDate && new Date() > coupon.expiryDate) {
      throw new BadRequestException('Coupon has expired');
    }

    if (coupon.minPurchase && cartTotal < Number(coupon.minPurchase)) {
      throw new BadRequestException(`Minimum purchase of ৳${coupon.minPurchase} required`);
    }

    if (coupon.maxUsage && coupon.usageCount >= coupon.maxUsage) {
      throw new BadRequestException('Coupon usage limit reached');
    }

    let discountAmount = 0;
    if (coupon.discountType === 'PERCENTAGE') {
      discountAmount = cartTotal * (Number(coupon.value) / 100);
    } else if (coupon.discountType === 'FIXED') {
      discountAmount = Number(coupon.value);
    }

    return {
      couponId: coupon.id,
      discountAmount,
      finalTotal: cartTotal - discountAmount
    };
  }
}
