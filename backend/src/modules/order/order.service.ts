import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { RedisService } from '../../core/redis/redis.service';

@Injectable()
export class OrderService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  async createOrder(userId: string, orderData: any) {
    const { items, addressId, paymentMethod } = orderData;

    // Use a transaction for atomic stock management
    return this.prisma.$transaction(async (tx) => {
      let total = 0;
      const orderItems = [];

      for (const item of items) {
        const variant = await tx.productVariant.findUnique({
          where: { id: item.variantId },
          include: { product: true }
        });

        if (!variant || variant.stock < item.quantity) {
          throw new BadRequestException(`Insufficient stock for ${variant?.sku || 'item'}`);
        }

        // Update stock atomically
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: { stock: { decrement: item.quantity } }
        });

        total += Number(variant.price || variant.product.basePrice) * item.quantity;
        orderItems.push({
          variantId: item.variantId,
          quantity: item.quantity,
          price: variant.price || variant.product.basePrice
        });
      }

      const orderNumber = `SPL-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      const order = await tx.order.create({
        data: {
          orderNumber,
          userId,
          totalAmount: total,
          taxAmount: total * 0.15, // 15% VAT placeholder
          shippingAmount: 500,    // Flat shipping placeholder
          status: 'PENDING_PAYMENT',
          items: { create: orderItems }
        }
      });

      return order;
    });
  }

  async handlePaymentWebhook(orderId: string, status: string) {
    const order = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: status === 'SUCCESS' ? 'PAID' : 'PENDING_PAYMENT' }
    });
    
    // Trigger Notifications via Event Bus (future-proof)
    return order;
  }
}
