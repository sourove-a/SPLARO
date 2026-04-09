import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';

@Injectable()
export class LogisticsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Calculates shipping rates based on zone and weight/volume.
   */
  async calculateShipping(city: string, country: string, weight: number) {
    const isInsideDhaka = city.toLowerCase() === 'dhaka';
    const baseRate = isInsideDhaka ? 60 : 120; // Default rates for BD
    const internationalRate = 2500; // Placeholder for worldwide DHL/FedEx

    if (country.toLowerCase() !== 'bangladesh') {
      return internationalRate;
    }
    return baseRate;
  }

  /**
   * Validates if an order can be returned based on the 7-day luxury policy.
   */
  async validateReturnRequest(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true }
    });

    if (!order || order.status !== 'DELIVERED') {
      throw new BadRequestException('Only delivered orders can be reviewed for returns.');
    }

    const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;
    const isWithinWindow = (new Date().getTime() - order.updatedAt.getTime()) < sevenDaysInMs;

    if (!isWithinWindow) {
      throw new BadRequestException('Return window (7 days) has expired for this order.');
    }

    return { eligible: true, orderNumber: order.orderNumber };
  }
}
