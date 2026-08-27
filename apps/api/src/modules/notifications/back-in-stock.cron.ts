import { Injectable, Logger, Optional } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { resolveCustomerFacingSiteUrl } from '@splaro/config'
import { PrismaService } from '../../common/prisma.service'
import { isSchedulerInstance } from '../../common/scheduler-instance.util'
import { EmailService } from '../email/email.service'
import {
  generateBackInStockHTML,
  generateBackInStockText,
} from '../email/back-in-stock-email.template'
import { SmsService } from './sms.service'
import { StockAlertService } from './stock-alert.service'

/**
 * Cap per store per pass. A bulk import that restocks the whole catalog would
 * otherwise try to send thousands of emails in one tick; the rest are simply
 * picked up on the next sweep, oldest request first.
 */
export const BACK_IN_STOCK_BATCH = 200

@Injectable()
export class BackInStockCron {
  private readonly logger = new Logger(BackInStockCron.name)
  private running = false

  constructor(
    private readonly prisma: PrismaService,
    private readonly stockAlerts: StockAlertService,
    private readonly email: EmailService,
    @Optional() private readonly sms?: SmsService,
  ) {}

  /**
   * Stock comes back from a dozen places — a received PO, a hand edit, a
   * cancelled order returning its reservation. Rather than hook every one of
   * them, sweep for alerts whose item is buyable again. An alert is only ever
   * created while the item is out of stock, so "buyable now" is the whole
   * condition; no transition tracking needed.
   */
  @Cron('*/10 * * * *')
  async sweep() {
    if (!isSchedulerInstance()) return
    if (this.running) return
    this.running = true
    try {
      const stores = await this.prisma.store.findMany({ select: { id: true, name: true } })
      for (const store of stores) {
        await this.sweepStore(store.id, store.name)
      }
    } catch (error) {
      this.logger.warn(
        `Back-in-stock sweep failed: ${error instanceof Error ? error.message : error}`,
      )
    } finally {
      this.running = false
    }
  }

  private async sweepStore(storeId: string, storeName: string): Promise<void> {
    const ready = await this.stockAlerts.findReady(storeId, BACK_IN_STOCK_BATCH)
    if (!ready.length) return

    const site = resolveCustomerFacingSiteUrl()
    const sent: string[] = []

    for (const alert of ready) {
      const productUrl = `${site}/products/${alert.product.slug}`
      const variantName = this.stockAlerts.variantLabelFor(alert.variant)

      const delivered =
        alert.channel === 'EMAIL'
          ? await this.sendEmail(storeId, storeName, alert, productUrl, variantName, site)
          : await this.sendSms(storeId, alert, productUrl, variantName)

      // Only a delivered alert is marked notified — a send that failed stays
      // waiting and is retried on the next sweep rather than lost silently.
      if (delivered) sent.push(alert.id)
    }

    await this.stockAlerts.markNotified(sent)
    if (sent.length) {
      this.logger.log(`Back-in-stock: notified ${sent.length} of ${ready.length} for ${storeId}`)
    }
  }

  private async sendEmail(
    storeId: string,
    storeName: string,
    alert: { id: string; contact: string; unsubscribeToken: string; product: { name: string } },
    productUrl: string,
    variantName: string | null,
    site: string,
  ): Promise<boolean> {
    const payload = {
      productName: alert.product.name,
      variantName,
      productUrl,
      unsubscribeUrl: `${site}/stock-alerts/unsubscribe?token=${encodeURIComponent(alert.unsubscribeToken)}`,
      storeName,
      siteUrl: site,
    }

    try {
      return await this.email.sendForStore({
        storeId,
        to: alert.contact,
        subject: `${alert.product.name} is back in stock`,
        html: generateBackInStockHTML(payload),
        text: generateBackInStockText(payload),
        // The shopper asked for this one message about this one item — it is
        // not marketing, and must not be gated on the newsletter toggle.
        transactional: true,
      })
    } catch (error) {
      this.logger.warn(
        `Back-in-stock email to ${alert.contact} failed: ${error instanceof Error ? error.message : error}`,
      )
      return false
    }
  }

  private async sendSms(
    storeId: string,
    alert: { contact: string; product: { name: string } },
    productUrl: string,
    variantName: string | null,
  ): Promise<boolean> {
    if (!this.sms) return false
    const label = variantName ? `${alert.product.name} (${variantName})` : alert.product.name
    try {
      const result = await this.sms.send(
        alert.contact,
        `${label} is back in stock at SPLARO. ${productUrl}`,
        storeId,
      )
      return result.sent
    } catch (error) {
      this.logger.warn(
        `Back-in-stock SMS to ${alert.contact} failed: ${error instanceof Error ? error.message : error}`,
      )
      return false
    }
  }
}
