import { Module } from '@nestjs/common';
import { CouponService } from './coupon.service';

@Module({
  providers: [CouponService],
  exports: [CouponService],
})
export class CouponModule {}
