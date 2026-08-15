import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { isSchedulerInstance } from '../../common/scheduler-instance.util'
import { AutomationService } from './automation.service'

@Injectable()
export class AutomationCron {
  private readonly logger = new Logger(AutomationCron.name)
  private running = false

  constructor(private readonly automationService: AutomationService) {}

  /**
   * Sweeps unpurchased cart sessions older than 2 hours and fires ABANDONED_CART automation.
   * Runs every 2 hours as configured by CRON_ABANDONED_CART.
   */
  @Cron(process.env.CRON_ABANDONED_CART || '0 */2 * * *')
  async handleAbandonedCarts(): Promise<void> {
    if (!isSchedulerInstance()) return
    if (this.running) return
    this.running = true
    try {
      const result = await this.automationService.sweepAbandonedCarts()
      if (result.swept > 0) {
        this.logger.log(`Abandoned cart automation sweep completed: ${result.swept} cart(s) triggered`)
      }
    } catch (err) {
      this.logger.warn(`Abandoned cart sweep error: ${err instanceof Error ? err.message : err}`)
    } finally {
      this.running = false
    }
  }
}
