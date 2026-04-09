import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { RedisService } from '../../core/redis/redis.service';

@Injectable()
export class CartService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  /**
   * Merges an anonymous guest cart from Redis into the user's persistent Database cart.
   * Called immediately after a successful login.
   */
  async mergeGuestCart(userId: string, guestCartId: string) {
    const guestItems = await this.redis.get(`cart:${guestCartId}`);
    if (!guestItems) return;

    const items = JSON.parse(guestItems);
    
    for (const item of items) {
      await this.prisma.cartItem.upsert({
        where: { 
          userId_variantId: { userId, variantId: item.variantId } 
        },
        update: { quantity: { increment: item.quantity } },
        create: { 
          userId, 
          variantId: item.variantId, 
          quantity: item.quantity 
        },
      });
    }

    // Clean up temporary guest cart
    await this.redis.del(`cart:${guestCartId}`);
  }
}
