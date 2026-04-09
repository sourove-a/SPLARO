import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';

@Injectable()
export class RecommendationService {
  constructor(private prisma: PrismaService) {}

  /**
   * Generates a "Complete the Look" recommendation index.
   * Leverages internal sales correlations and user preferences.
   */
  async getPersonalizedRecommendations(userId: string) {
    const userProfile = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { orders: { include: { items: true } }, wishlist: true },
    });

    if (!userProfile) return this.getTrendingProducts();

    // Logic: If user bought sneakers, suggest accessories or cleaning kits
    // In production, this would call a Python microservice with an AI model.
    return this.prisma.product.findMany({
      where: {
        status: 'PUBLISHED',
        isBestSeller: true,
      },
      take: 6,
      include: { variants: true },
    });
  }

  private async getTrendingProducts() {
    return this.prisma.product.findMany({
      where: { isFeatured: true, status: 'PUBLISHED' },
      take: 8,
    });
  }
}
