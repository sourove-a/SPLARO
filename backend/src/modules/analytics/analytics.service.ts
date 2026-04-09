import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async getDashboardSummary() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalRevenue, orderCount, activeUsers] = await Promise.all([
      this.prisma.order.aggregate({
        where: { status: 'PAID', createdAt: { gte: today } },
        _sum: { totalAmount: true }
      }),
      this.prisma.order.count({
        where: { createdAt: { gte: today } }
      }),
      this.prisma.user.count({
        where: { updatedAt: { gte: today } }
      })
    ]);

    return {
      dailyRevenue: totalRevenue._sum.totalAmount || 0,
      dailyOrders: orderCount,
      activeUsersToday: activeUsers,
      healthStatus: 'OPTIMAL'
    };
  }

  async getTopSellingProducts() {
    // In production, use raw SQL or specialized grouping to find best sellers
    return this.prisma.product.findMany({
      where: { isBestSeller: true },
      take: 5
    });
  }
}
