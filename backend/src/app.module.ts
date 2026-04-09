import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { OrderModule } from './modules/order/order.module';
import { AiModule } from './modules/ai/ai.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { PaymentModule } from './modules/payment/payment.module';
import { NotificationModule } from './modules/notification/notification.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { CouponModule } from './modules/coupons/coupon.module';
import { LoyaltyModule } from './modules/loyalty/loyalty.module';
import { CartModule } from './modules/cart/cart.module';
import { LogisticsModule } from './modules/logistics/logistics.module';
import { CmsModule } from './modules/cms/cms.module';
import { PrismaModule } from './core/prisma/prisma.module';
import { RedisModule } from './core/redis/redis.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    RedisModule,
    AuthModule,
    UserModule,
    CatalogModule,
    OrderModule,
    AiModule,
    InventoryModule,
    PaymentModule,
    NotificationModule,
    AnalyticsModule,
    CouponModule,
    LoyaltyModule,
    CartModule,
    LogisticsModule,
    CmsModule,
  ],
})
export class AppModule {}
