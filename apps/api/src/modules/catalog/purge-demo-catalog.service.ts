import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'
import { resolveStoreId } from '../../common/store.util'
import {
  purgeDemoCatalogCore,
  type PurgeDemoCatalogResult,
} from './purge-demo-catalog.core'

export type { PurgeDemoCatalogResult }

@Injectable()
export class PurgeDemoCatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async purge(storeIdOrSlug: string): Promise<PurgeDemoCatalogResult> {
    const sid = await resolveStoreId(this.prisma, storeIdOrSlug)
    return purgeDemoCatalogCore(this.prisma, sid)
  }
}
