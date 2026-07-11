import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'
import { resolveStoreId } from '../../common/store.util'
import { seedDemoCatalogCore, type SeedDemoCatalogResult } from './seed-demo-catalog.core'

export type { SeedDemoCatalogResult }

@Injectable()
export class SeedDemoCatalogService implements OnModuleInit {
  private readonly logger = new Logger(SeedDemoCatalogService.name)

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    if (process.env.NODE_ENV !== 'production') return
    const store = (process.env.NEXT_PUBLIC_STORE_ID ?? 'splaro').trim()
    try {
      const result = await this.seedIfEmpty(store)
      if (result.productsCreated > 0) {
        this.logger.log(
          `Seeded ${result.productsCreated} demo product(s) for ${store}: ${result.slugs.join(', ')}`,
        )
      }
    } catch (err) {
      this.logger.warn(`Demo catalog boot seed skipped: ${String(err)}`)
    }
  }

  async seedIfEmpty(storeIdOrSlug: string): Promise<SeedDemoCatalogResult> {
    const sid = await resolveStoreId(this.prisma, storeIdOrSlug)
    return seedDemoCatalogCore(this.prisma, sid)
  }
}
