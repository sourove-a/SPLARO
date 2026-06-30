import { Injectable, Logger } from '@nestjs/common'
import { createHash } from 'crypto'

interface PurchaseEventInput {
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

  async trackPurchase(input: PurchaseEventInput): Promise<void> {
    const pixelId = process.env['FB_PIXEL_ID'] ?? process.env['NEXT_PUBLIC_FB_PIXEL_ID']
    const token = process.env['FB_CAPI_ACCESS_TOKEN']
    if (!pixelId || !token) return

    const eventTime = Math.floor(Date.now() / 1000)
    const payload = {
      data: [
        {
          event_name: 'Purchase',
          event_time: eventTime,
          event_id: input.orderId,
          action_source: 'website',
          event_source_url: input.eventSourceUrl ?? process.env['WEB_URL'] ?? 'https://splaro.com.bd',
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
