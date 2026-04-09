import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Fetches global configuration that controls site behavior.
   * Can be used for Feature Flags, AI Prompts, and Dynamic Costs.
   */
  async getGlobalSettings() {
    const settings = await this.prisma.settings.findMany();
    return settings.reduce((acc, curr) => ({ ...acc, [curr.key]: curr.value }), {});
  }

  /**
   * Admin-only: Updates any key-value configuration.
   * Changes take effect instantly without code redeploy.
   */
  async updateSetting(key: string, value: any) {
    return this.prisma.settings.upsert({
      where: { key },
      update: { value },
      create: { key, value }
    });
  }

  /**
   * Database Indexing Suggestions for Performance
   * 1. Index on `Order.status` and `Order.createdAt` (for reporting)
   * 2. Index on `ProductVariant.sku` (for inventory lookups)
   * 3. Index on `User.email` (for auth speed)
   */
}
