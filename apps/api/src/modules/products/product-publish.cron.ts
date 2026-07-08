import { Injectable, Logger, Optional } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { PrismaService } from '../../common/prisma.service'
import { CacheService } from '../../common/cache.service'
import { SearchService } from '../search/search.service'
import { refreshProductCatalogAfterMutation } from './product-catalog-refresh.util'

@Injectable()
export class ProductPublishCron {
  private readonly logger = new Logger(ProductPublishCron.name)
  private running = false

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    @Optional() private readonly search: SearchService,
  ) {}

  /** Flip SCHEDULED products whose publishAt has passed to live on the storefront. */
  @Cron('*/5 * * * *')
  async publishDueProducts() {
    if (this.running) return
    this.running = true
    try {
      let due: { id: string; storeId: string }[]
      try {
        due = await this.prisma.product.findMany({
          where: {
            status: 'SCHEDULED',
            publishAt: { lte: new Date() },
          },
          select: { id: true, storeId: true },
        })
      } catch (error) {
        this.logger.warn(`Scheduled publish query failed: ${error}`)
        return
      }

      if (!due.length) return

      for (const row of due) {
        try {
          await this.prisma.product.update({
            where: { id: row.id },
            data: { isPublished: true, status: 'PUBLISHED' },
          })
          await refreshProductCatalogAfterMutation(
            { cache: this.cache, search: this.search },
            row.storeId,
          )
          this.logger.log(`Published scheduled product ${row.id} (store ${row.storeId})`)
        } catch (error) {
          this.logger.warn(`Failed to publish scheduled product ${row.id}: ${error}`)
        }
      }
    } finally {
      this.running = false
    }
  }
}
