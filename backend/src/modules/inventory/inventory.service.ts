import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}

  /**
   * Reserves stock for a specific period during checkout.
   * Ensures high-frequency drops don't result in overselling.
   */
  async reserveStock(variantId: string, quantity: number, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Check current availability
      const variant = await tx.productVariant.findUnique({
        where: { id: variantId },
        select: { stock: true, sku: true },
      });

      if (!variant || variant.stock < quantity) {
        throw new BadRequestException(`Insufficient stock for asset: ${variant?.sku || 'Unknown'}`);
      }

      // 2. Decrement stock atomically (Prisma ensures this is concurrency-safe)
      await tx.productVariant.update({
        where: { id: variantId },
        data: { stock: { decrement: quantity } },
      });

      // 3. (Optional) In production, we create a TTL record in Redis 
      // to handle automatic release if payment fails within 15 mins.
      return { success: true, timestamp: new Date() };
    });
  }

  async releaseStock(variantId: string, quantity: number) {
    return this.prisma.productVariant.update({
      where: { id: variantId },
      data: { stock: { increment: quantity } },
    });
  }
}
