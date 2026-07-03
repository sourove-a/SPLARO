import { Injectable, Logger } from '@nestjs/common'
import { createHash } from 'crypto'
import { PrismaService } from '../../common/prisma.service'
import {
  resolveMetaAccessToken,
  resolveMetaPixelId,
  resolveMetaWebUrl,
} from './meta-marketing.util'

interface PurchaseEventInput {
  storeId?: string
  orderId: string
  total: number
  currency?: string
  email?: string
  phone?: string
  fbclid?: string | null
  clientIp?: string | null
  userAgent?: string | null
  eventSourceUrl?: string | null
}

@Injectable()
export class MetaCapiService {
  private readonly logger = new Logger(MetaCapiService.name)

  constructor(private readonly prisma: PrismaService) {}

  async resolvePixelId(storeId?: string): Promise<string> {
    if (storeId) {
      const settings = await this.prisma.siteSettings.findUnique({
        where: { storeId },
        select: { facebookPixelId: true },
      })
      return resolveMetaPixelId(settings ?? undefined)
    }
    return resolveMetaPixelId()
  }

  async testConnection(storeId?: string): Promise<{ ok: boolean; message: string; pixelId?: string }> {
    const pixelId = await this.resolvePixelId(storeId)
    const token = resolveMetaAccessToken()
    if (!pixelId) {
      return { ok: false, message: 'Meta Pixel ID missing — set in Admin → Marketing or .env' }
    }
    if (!token) {
      return { ok: false, message: 'Meta access token missing — set FB_CAPI_ACCESS_TOKEN in .env' }
    }

    try {
      const res = await fetch(
        `https://graph.facebook.com/v19.0/${encodeURIComponent(pixelId)}?fields=id,name&access_token=${encodeURIComponent(token)}`,
      )
      const body = (await res.json()) as { id?: string; name?: string; error?: { message?: string } }
      if (!res.ok) {
        return {
          ok: false,
          message: body.error?.message ?? `Meta API error ${res.status}`,
          pixelId,
        }
      }
      const label = body.name ? `${body.name} (${body.id ?? pixelId})` : pixelId
      return { ok: true, message: `Meta Pixel connected · ${label}`, pixelId }
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : 'Meta connection failed',
        pixelId,
      }
    }
  }

  async trackPurchase(input: PurchaseEventInput): Promise<void> {
    const pixelId = await this.resolvePixelId(input.storeId)
    const token = resolveMetaAccessToken()
    if (!pixelId || !token) return

    const eventTime = Math.floor(Date.now() / 1000)
    const payload = {
      data: [
        {
          event_name: 'Purchase',
          event_time: eventTime,
          event_id: input.orderId,
          action_source: 'website',
          event_source_url: input.eventSourceUrl ?? resolveMetaWebUrl(),
          user_data: {
            ...(input.email ? { em: [this.hash(input.email.toLowerCase())] } : {}),
            ...(input.phone ? { ph: [this.hash(input.phone.replace(/\D/g, ''))] } : {}),
            ...(input.clientIp ? { client_ip_address: input.clientIp } : {}),
            ...(input.userAgent ? { client_user_agent: input.userAgent } : {}),
            ...(input.fbclid ? { fbc: `fb.1.${eventTime}.${input.fbclid}` } : {}),
          },
          custom_data: {
            currency: input.currency ?? 'BDT',
            value: input.total,
            order_id: input.orderId,
          },
        },
      ],
    }

    try {
      const res = await fetch(
        `https://graph.facebook.com/v19.0/${pixelId}/events?access_token=${encodeURIComponent(token)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      )
      if (!res.ok) {
        const text = await res.text()
        this.logger.warn(`Meta CAPI Purchase failed: ${res.status} ${text.slice(0, 200)}`)
      }
    } catch (err) {
      this.logger.warn(`Meta CAPI error: ${err instanceof Error ? err.message : 'unknown'}`)
    }
  }

  private hash(value: string): string {
    return createHash('sha256').update(value).digest('hex')
  }
}
