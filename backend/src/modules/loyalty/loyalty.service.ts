import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';

@Injectable()
export class LoyaltyService {
  constructor(private prisma: PrismaService) {}

  async awardPoints(userId: string, orderTotal: number) {
    // Standard rule: 1 point for every 100 Taka spent
    const pointsEarned = Math.floor(orderTotal / 100);

    const profile = await this.prisma.loyaltyProfile.upsert({
      where: { userId },
      update: { 
        points: { increment: pointsEarned },
      },
      create: { 
        userId, 
        points: pointsEarned,
        tier: 'SILVER'
      },
    });

    // Tier Upgrade Logic
    let newTier = profile.tier;
    if (profile.points > 10000) newTier = 'NOIR';
    else if (profile.points > 5000) newTier = 'PLATINUM';
    else if (profile.points > 2000) newTier = 'GOLD';

    if (newTier !== profile.tier) {
      await this.prisma.loyaltyProfile.update({
        where: { userId },
        data: { tier: newTier }
      });
      // Optionally fire a 'TierUpgraded' event for notifications
    }

    return { pointsEarned, currentTier: newTier };
  }
}
