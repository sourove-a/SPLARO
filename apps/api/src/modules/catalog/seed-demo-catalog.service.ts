import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'
import { resolveStoreId } from '../../common/store.util'
import { seedDemoCatalogCore, type SeedDemoCatalogResult } from './seed-demo-catalog.core'

export type { SeedDemoCatalogResult }

@Injectable()
export class SeedDemoCatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async seedIfEmpty(storeIdOrSlug: string): Promise<SeedDemoCatalogResult> {
    const sid = await resolveStoreId(this.prisma, storeIdOrSlug)
    return seedDemoCatalogCore(this.prisma, sid)
  }
}
