import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import { Queue } from 'bullmq'
import { PrismaService } from '../../common/prisma.service'
import { ConfigService } from '@nestjs/config'
import { EmailService } from '../email/email.service'
import { SmsService } from '../notifications/sms.service'
import { generateCampaignEmailHTML } from './campaign-email.template'
import {
  CAMPAIGN_AUDIENCES,
  CAMPAIGN_TYPES,
  type CampaignAudience,
  type CampaignType,
} from './marketing.dto'
import { resolveCustomerFacingSiteUrl } from '@splaro/config'

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
  type: CampaignType
  targetAudience: CampaignAudience
  targetTag?: string
  scheduledAt?: Date
}

interface CampaignUpdateData {
  name?: string
  subject?: string
  body?: string
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
    @Optional() private readonly sms?: SmsService,
  ) {
    this.openai = null
  }

  // ── CAMPAIGN BUILDER ──────────────────────────────────────

  async createCampaign(data: CampaignCreateData) {
    const name = data.name.trim()
    const subject = data.subject.trim()
    const body = data.body.trim()
    if (!name || !subject || !body) {
      throw new BadRequestException('Campaign name, subject, and message are required.')
    }
    if (!CAMPAIGN_TYPES.includes(data.type)) {
      throw new BadRequestException(`${data.type} campaigns are not supported.`)
    }
    if (!CAMPAIGN_AUDIENCES.includes(data.targetAudience)) {
      throw new BadRequestException(`${data.targetAudience} is not a supported audience.`)
    }
    const targetTag = data.targetTag?.trim()
    if (data.targetAudience === 'TAG' && !targetTag) {
      throw new BadRequestException('A tag is required for the TAG audience.')
    }

    const campaign = await this.prisma.campaign.create({
      data: {
        storeId: data.storeId,
        name,
        subject,
        body,
        type: data.type,
        recipientType: data.targetAudience === 'TAG' ? 'TAG' : data.targetAudience,
        recipientTags: targetTag ? [targetTag] : [],
        status: data.scheduledAt ? 'SCHEDULED' : 'DRAFT',
        scheduledAt: data.scheduledAt,
      },
    })

    if (!data.scheduledAt) return campaign

    // Queue for delivery
    const delay = data.scheduledAt.getTime() - Date.now()
    try {
      await this.marketingQueue.add(
        'send-campaign',
        { campaignId: campaign.id },
        { delay: Math.max(0, delay), jobId: `campaign:${campaign.id}` },
      )
    } catch (error) {
      await this.prisma.campaign.update({
        where: { id: campaign.id },
        data: { status: 'DRAFT', scheduledAt: null },
      })
      this.logger.error(`Could not queue campaign "${name}"`, error)
      throw new BadRequestException('Campaign was saved as a draft because scheduling failed.')
    }
    this.logger.log(`Campaign "${name}" scheduled for ${data.scheduledAt.toISOString()}`)

    return campaign
  }

  async getCampaign(campaignId: string, storeId: string) {
    const campaign = await this.prisma.campaign.findFirst({ where: { id: campaignId, storeId } })
    if (!campaign) throw new NotFoundException('Campaign not found')
    return campaign
  }

  async updateCampaign(campaignId: string, data: CampaignUpdateData, storeId: string) {
    const existing = await this.getCampaign(campaignId, storeId)
    if (existing.status === 'SENDING' || existing.status === 'SENT') {
      throw new ConflictException('Sent campaigns cannot be edited.')
    }
    const update = {
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.subject !== undefined ? { subject: data.subject.trim() } : {}),
      ...(data.body !== undefined ? { body: data.body.trim() } : {}),
    }
    if (Object.keys(update).length === 0 || Object.values(update).some((value) => !value)) {
      throw new BadRequestException('Campaign fields cannot be empty.')
    }
    return this.prisma.campaign.update({ where: { id: campaignId }, data: update })
  }

  async deleteCampaign(campaignId: string, storeId: string) {
    await this.getCampaign(campaignId, storeId)
    await this.prisma.campaign.delete({ where: { id: campaignId } })
    return { deleted: campaignId }
  }

  async duplicateCampaign(campaignId: string, storeId: string) {
    const original = await this.getCampaign(campaignId, storeId)
    return this.prisma.campaign.create({
      data: {
        storeId,
        name: `${original.name} (copy)`,
        subject: original.subject,
        body: original.body,
        type: original.type,
        recipientType: original.recipientType,
        recipientTags: original.recipientTags,
        status: 'DRAFT',
        scheduledAt: null,
      },
    })
  }

  async sendCampaignNow(campaignId: string, storeId?: string): Promise<{ sent: number }> {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id: campaignId, ...(storeId ? { storeId } : {}) },
    })
    if (!campaign) throw new NotFoundException('Campaign not found')
    if (campaign.status === 'SENT') {
      throw new ConflictException('Campaign has already been sent.')
    }
    if (campaign.status === 'SENDING') {
      throw new ConflictException('Campaign is already being sent.')
    }
    if (!CAMPAIGN_TYPES.includes(campaign.type as CampaignType)) {
      throw new BadRequestException(`${campaign.type} delivery is not connected. Nothing was sent.`)
    }

    if (campaign.type === 'SMS') {
      if (!this.sms) {
        throw new BadRequestException('SMS service is not available. Nothing was sent.')
      }
      const recipients = await this.getRecipients(
        campaign.storeId,
        campaign.recipientType,
        campaign.recipientTags[0],
        'sms',
      )
      if (recipients.length === 0) {
        throw new BadRequestException('No SMS recipients matched this segment.')
      }

      await this.claimCampaignForSending(campaignId, campaign.status)
      let sent = 0
      for (const recipient of recipients) {
        if (!recipient.phone) continue
        let result: { sent: boolean }
        try {
          result = await this.sms.send(recipient.phone, campaign.body, campaign.storeId)
        } catch (error) {
          await this.markCampaignFailed(campaignId, sent)
          throw error
        }
        if (result.sent) sent += 1
      }

      await this.completeCampaign(campaignId, sent)
      return { sent }
    }

    if (campaign.type !== 'EMAIL') {
      throw new BadRequestException(`${campaign.type} delivery is not connected. Nothing was sent.`)
    }
    const recipients = await this.getRecipients(
      campaign.storeId,
      campaign.recipientType,
      campaign.recipientTags[0],
      'email',
    )
    this.logger.log(`Sending campaign "${campaign.name}" to ${recipients.length} recipients`)

    await this.claimCampaignForSending(campaignId, campaign.status)
    let sent = 0
    for (const recipient of recipients) {
      if (!recipient.email) continue
      let accepted: boolean
      try {
        accepted = await this.email.sendForStore({
          storeId: campaign.storeId,
          to: recipient.email,
          subject: campaign.subject?.trim() || campaign.name,
          html: generateCampaignEmailHTML({
            subject: campaign.subject?.trim() || campaign.name,
            body: campaign.body,
            customerName: `${recipient.firstName} ${recipient.lastName}`.trim(),
            siteUrl: resolveCustomerFacingSiteUrl(),
          }),
          text: campaign.body,
        })
      } catch (error) {
        await this.markCampaignFailed(campaignId, sent)
        throw error
      }
      if (accepted) sent += 1
    }

    await this.completeCampaign(campaignId, sent)
    return { sent }
  }

  private async claimCampaignForSending(campaignId: string, currentStatus: string) {
    const result = await this.prisma.campaign.updateMany({
      where: {
        id: campaignId,
        status: {
          in:
            currentStatus === 'SCHEDULED' ? ['SCHEDULED', 'DRAFT', 'FAILED'] : ['DRAFT', 'FAILED'],
        },
      },
      data: { status: 'SENDING' },
    })
    if (result.count !== 1) {
      throw new ConflictException('Campaign is already being sent or has already been sent.')
    }
  }

  private async markCampaignFailed(campaignId: string, sent: number) {
    await this.prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'FAILED', totalSent: sent, totalDelivered: sent },
    })
  }

  private async completeCampaign(campaignId: string, sent: number): Promise<void> {
    await this.prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: sent > 0 ? 'SENT' : 'FAILED',
        sentAt: sent > 0 ? new Date() : null,
        totalSent: sent,
        totalDelivered: sent,
      },
    })
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

  async sendBroadcastPush(
    storeId: string,
    title: string,
    body: string,
    url?: string,
  ): Promise<number> {
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

  private async getRecipients(
    storeId: string,
    audience: string,
    tag?: string,
    channel: 'email' | 'sms' = 'email',
  ) {
    const where: Record<string, unknown> = { storeId, acceptMarketing: true }
    if (channel === 'email') {
      where['email'] = { not: null }
    } else {
      where['phone'] = { not: '' }
    }

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

    return this.prisma.customer.findMany({
      where,
      select: { id: true, phone: true, email: true, firstName: true, lastName: true },
    })
  }

  async getCampaigns(storeId: string) {
    return this.prisma.campaign.findMany({
      where: { storeId },
      orderBy: { createdAt: 'desc' },
    })
  }
}
