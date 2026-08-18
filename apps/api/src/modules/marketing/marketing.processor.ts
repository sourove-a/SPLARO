import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Injectable, Logger, Optional } from '@nestjs/common'
import { Job } from 'bullmq'
import { PrismaService } from '../../common/prisma.service'
import { SmsService } from '../notifications/sms.service'
import { MarketingService } from './marketing.service'

interface SendCampaignPayload {
  campaignId: string
}

interface AbandonedCartPayload {
  customerId: string
  storeId: string
}

interface WebPushPayload {
  endpoint: string
  title: string
  body: string
  url?: string
}

/**
 * Worker for the `marketing` queue.
 *
 * The queue had producers but no consumer, so every scheduled campaign,
 * abandoned-cart reminder and push notification was accepted by the API,
 * written into Redis, and then never processed — the caller saw success and
 * nothing was ever sent.
 */
@Injectable()
@Processor('marketing')
export class MarketingProcessor extends WorkerHost {
  private readonly logger = new Logger(MarketingProcessor.name)

  constructor(
    private readonly marketing: MarketingService,
    private readonly prisma: PrismaService,
    @Optional() private readonly sms?: SmsService,
  ) {
    super()
  }

  async process(job: Job): Promise<unknown> {
    switch (job.name) {
      case 'send-campaign':
        return this.sendCampaign(job.data as SendCampaignPayload)
      case 'abandoned-cart-sms':
        return this.abandonedCartSms(job.data as AbandonedCartPayload)
      case 'web-push':
        return this.webPush(job.data as WebPushPayload)
      default:
        this.logger.warn(`Unknown marketing job: ${job.name}`)
        return undefined
    }
  }

  private async sendCampaign(payload: SendCampaignPayload) {
    const result = await this.marketing.sendCampaignNow(payload.campaignId)
    this.logger.log(`Campaign ${payload.campaignId} sent to ${result.sent} recipient(s)`)
    return result
  }

  private async abandonedCartSms(payload: AbandonedCartPayload) {
    if (!this.sms) {
      // Throwing would retry forever against a provider that is not configured.
      this.logger.error('Abandoned-cart SMS skipped — no SMS provider is configured')
      return { sent: false }
    }
    const customer = await this.prisma.customer.findFirst({
      where: { id: payload.customerId, storeId: payload.storeId },
      select: { phone: true, firstName: true },
    })
    if (!customer?.phone) {
      this.logger.warn(`Abandoned-cart SMS skipped — customer ${payload.customerId} has no phone`)
      return { sent: false }
    }

    const name = customer.firstName?.trim()
    const message = `${name ? `${name}, ` : ''}your SPLARO cart is still waiting. Complete your order before the items sell out.`
    const result = await this.sms.send(customer.phone, message, payload.storeId)
    return { sent: result.sent }
  }

  private async webPush(payload: WebPushPayload) {
    /*
     * There is no web-push transport in this project — no VAPID keys and no
     * sender library. Failing the job would retry against something that cannot
     * exist, so it is logged once and completed. Wire a transport before
     * relying on `sendWebPush` / `sendBroadcastPush`.
     */
    this.logger.error(
      `Web push not delivered — no push transport configured (endpoint ${payload.endpoint.slice(0, 40)}…)`,
    )
    return { sent: false }
  }
}
