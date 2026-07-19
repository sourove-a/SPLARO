import { Injectable, Logger } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import { Queue } from 'bullmq'
import { PrismaService } from '../../common/prisma.service'
import { ConfigService } from '@nestjs/config'
import { BadRequestException } from '@nestjs/common'
import { EmailService } from '../email/email.service'
import { generateCampaignEmailHTML } from './campaign-email.template'

type OpenAIClient = {
  chat: {
    completions: {
      create(input: unknown): Promise<{ choices: { message: { content: string | null } }[] }>
    }
  }
}

interface CampaignCreateData {
  storeId: string
  name: string
  subject: string
  body: string
  type: 'EMAIL' | 'SMS' | 'PUSH' | 'WHATSAPP'
  targetAudience: 'ALL' | 'LOYAL' | 'INACTIVE' | 'HIGH_SPENDERS' | 'TAG'
  targetTag?: string
  scheduledAt?: Date
}

@Injectable()
export class MarketingService {
  private readonly logger = new Logger(MarketingService.name)
  private openai: OpenAIClient | null = null

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @InjectQueue('marketing') private readonly marketingQueue: Queue,
    private readonly email: EmailService,
  ) {
    this.openai = null
  }

  // ── CAMPAIGN BUILDER ──────────────────────────────────────

  async createCampaign(data: CampaignCreateData) {
    const campaign = await this.prisma.campaign.create({
      data: {
        storeId: data.storeId,
        name: data.name,
        subject: data.subject,
        body: data.body,
        type: data.type,
        recipientType: data.targetAudience === 'TAG' ? 'TAG' : data.targetAudience,
        recipientTags: data.targetTag ? [data.targetTag] : [],
        status: data.scheduledAt ? 'SCHEDULED' : 'DRAFT',
        scheduledAt: data.scheduledAt,
      },
    })

    if (!data.scheduledAt) return campaign

    // Queue for delivery
    const delay = data.scheduledAt.getTime() - Date.now()
    await this.marketingQueue.add('send-campaign', { campaignId: campaign.id }, { delay: Math.max(0, delay) })
    this.logger.log(`Campaign "${data.name}" scheduled for ${data.scheduledAt.toISOString()}`)

    return campaign
  }

  async sendCampaignNow(campaignId: string): Promise<{ sent: number }> {
    const campaign = await this.prisma.campaign.findUnique({ where: { id: campaignId } })
    if (!campaign) throw new Error(`Campaign ${campaignId} not found`)

    if (campaign.type !== 'EMAIL') {
      throw new BadRequestException(`${campaign.type} delivery is not connected. Nothing was sent.`)
    }
    const recipients = await this.getRecipients(campaign.storeId, campaign.recipientType, campaign.recipientTags[0])
    this.logger.log(`Sending campaign "${campaign.name}" to ${recipients.length} recipients`)

    await this.prisma.campaign.update({ where: { id: campaignId }, data: { status: 'SENDING' } })
    let sent = 0
    for (const recipient of recipients) {
      if (!recipient.email) continue
      const accepted = await this.email.sendForStore({
        storeId: campaign.storeId,
        to: recipient.email,
        subject: campaign.subject?.trim() || campaign.name,
        html: generateCampaignEmailHTML({
          subject: campaign.subject?.trim() || campaign.name,
          body: campaign.body,
          customerName: `${recipient.firstName} ${recipient.lastName}`.trim(),
          siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL,
        }),
        text: campaign.body,
      })
      if (accepted) sent += 1
    }

    await this.prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: sent > 0 ? 'SENT' : 'FAILED',
        sentAt: sent > 0 ? new Date() : null,
        totalSent: sent,
        totalDelivered: sent,
      },
    })
    return { sent }
  }

  // ── ABANDONED CART FLOW ───────────────────────────────────

  async triggerAbandonedCartFlow(storeId: string): Promise<number> {
    const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000) // 2 hours ago

    // Find customers with unpurchased carts (simplified — in prod use cart model)
    const abandoned = await this.prisma.customer.findMany({
      where: {
        storeId,
        updatedAt: { lte: cutoff },
        // hasActiveCart would be a real field in prod schema
      },
      select: { id: true, phone: true, email: true },
      take: 100,
    })

    for (const customer of abandoned) {
      await this.marketingQueue.add(
        'abandoned-cart-sms',
        { customerId: customer.id, storeId },
        { delay: 0, attempts: 1 },
      )
    }

    return abandoned.length
  }

  // ── AI COPY GENERATOR ─────────────────────────────────────

  async generateCampaignCopy(data: {
    campaignType: string
    targetAudience: string
    productNames: string[]
    tone: 'luxury' | 'casual' | 'urgent' | 'festive'
    language: 'en' | 'bn' | 'both'
  }): Promise<{ subject: string; body: string; smsText: string }> {
    if (!this.openai) {
      return {
        subject: `New arrivals just for you — SPLARO`,
        body: `Discover our latest collection at SPLARO. Shop now and enjoy exclusive member benefits.`,
        smsText: `SPLARO: New arrivals! Shop now at splaro.co`,
      }
    }

    const prompt = `You are a luxury fashion copywriter for SPLARO, a premium women's fashion brand from Bangladesh.
Write campaign copy with these specs:
- Type: ${data.campaignType}
- Audience: ${data.targetAudience}
- Products: ${data.productNames.join(', ')}
- Tone: ${data.tone}
- Language: ${data.language === 'both' ? 'English with some Bengali phrases' : data.language === 'bn' ? 'Bengali (Bangla)' : 'English'}

Return JSON with: { subject, body, smsText }
- subject: 50 chars max, compelling
- body: 100-150 words, persuasive
- smsText: 160 chars max for SMS`

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      max_tokens: 400,
    })

    const result = JSON.parse(completion.choices[0]?.message.content ?? '{}') as {
      subject?: string
      body?: string
      smsText?: string
    }

    return {
      subject: result.subject ?? 'New Collection from SPLARO',
      body: result.body ?? '',
      smsText: result.smsText ?? '',
    }
  }

  // ── PUSH NOTIFICATIONS ────────────────────────────────────

  async sendWebPush(customerId: string, title: string, body: string, url?: string): Promise<void> {
    const tokens = await this.prisma.webPushToken.findMany({
      where: { customerId },
    })

    for (const token of tokens) {
      await this.marketingQueue.add('web-push', { endpoint: token.endpoint, title, body, url })
    }
  }

  async sendBroadcastPush(storeId: string, title: string, body: string, url?: string): Promise<number> {
    const tokens = await this.prisma.webPushToken.findMany({
      where: { storeId },
      take: 10000,
    })

    for (const token of tokens) {
      await this.marketingQueue.add('web-push', { endpoint: token.endpoint, title, body, url })
    }

    return tokens.length
  }

  // ── HELPERS ───────────────────────────────────────────────

  private async getRecipients(storeId: string, audience: string, tag?: string) {
    const where: Record<string, unknown> = { storeId, acceptMarketing: true, email: { not: null } }

    if (audience === 'LOYAL') {
      where['loyaltyTier'] = { in: ['GOLD', 'PLATINUM', 'DIAMOND'] }
    } else if (audience === 'HIGH_SPENDERS') {
      where['totalSpent'] = { gte: 10000 }
    } else if (audience === 'INACTIVE') {
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - 30)
      where['lastOrderDate'] = { lt: cutoff }
    } else if (audience === 'TAG' && tag) {
      where['tags'] = { has: tag }
    }

    return this.prisma.customer.findMany({ where, select: { id: true, phone: true, email: true, firstName: true, lastName: true } })
  }

  async getCampaigns(storeId: string) {
    return this.prisma.campaign.findMany({
      where: { storeId },
      orderBy: { createdAt: 'desc' },
    })
  }
}
