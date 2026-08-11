import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { PrismaService } from '../../common/prisma.service'
import { isSchedulerInstance } from '../../common/scheduler-instance.util'
import { findLowStockVariants } from './low-stock.util'
import { NotificationsService } from './notifications.service'

/** Never alert on more than this many SKUs in one pass — a fresh import can
 *  legitimately leave hundreds at zero, and that must not flood the tray. */
export const LOW_STOCK_ALERT_LIMIT = 20

@Injectable()
export class StockAlertsCron {
  private readonly logger = new Logger(StockAlertsCron.name)
  private running = false

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Order-time checks only catch a SKU the moment it is sold. This sweep
   * catches everything else — stock edited down by hand, a return that never
   * came back, an import that landed short.
   */
  @Cron('0 */4 * * *')
  async sweepLowStock() {
    if (!isSchedulerInstance()) return
    if (this.running) return
    this.running = true
    try {
      const stores = await this.prisma.store.findMany({ select: { id: true } })
      for (const store of stores) {
        const variants = await findLowStockVariants(
          this.prisma,
          store.id,
          LOW_STOCK_ALERT_LIMIT,
        )
        for (const variant of variants) {
          await this.notifications.notifyLowStock(
            store.id,
            variant.productName,
            variant.sku,
            variant.stock,
          )
        }
      }
    } catch (error) {
      this.logger.warn(`Low-stock sweep failed: ${error instanceof Error ? error.message : error}`)
    } finally {
      this.running = false
    }
  }
}
