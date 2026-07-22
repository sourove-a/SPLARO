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
  fbp?: string | null
  fbc?: string | null
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

    const order = await this.prisma.order.findUnique({
      where: { id: input.orderId },
      select: {
        invoiceNumber: true,
        fbclid: true,
        fbp: true,
        fbc: true,
        landingPage: true,
        clientIp: true,
        items: {
          select: {
            productId: true,
            quantity: true,
            price: true,
            productName: true,
          },
        },
      },
    })
    if (!order) return

    const eventId = order.invoiceNumber ?? input.orderId
    const eventTime = Math.floor(Date.now() / 1000)
    const fbclid = input.fbclid ?? order.fbclid
    const fbp = input.fbp ?? order.fbp
    const fbc =
      input.fbc ??
      order.fbc ??
      (fbclid ? `fb.1.${eventTime}.${fbclid}` : null)
    const contentIds = order.items.map((item) => item.productId)
    const contents = order.items.map((item) => ({
      id: item.productId,
      quantity: item.quantity,
      item_price: Number(item.price),
    }))
    const phone = this.normalizeBdPhone(input.phone)
    const sourceUrl = this.resolveEventSourceUrl(input.eventSourceUrl ?? order.landingPage)
    const clientIp = input.clientIp ?? order.clientIp

    const payload = {
      data: [
        {
          event_name: 'Purchase',
          event_time: eventTime,
          event_id: eventId,
          action_source: 'website',
          event_source_url: sourceUrl,
          user_data: {
            ...(input.email ? { em: [this.hash(input.email.trim().toLowerCase())] } : {}),
            ...(phone ? { ph: [this.hash(phone)] } : {}),
            ...(phone ? { external_id: [this.hash(phone)] } : {}),
            ...(clientIp ? { client_ip_address: clientIp } : {}),
            ...(input.userAgent ? { client_user_agent: input.userAgent } : {}),
            ...(fbp ? { fbp } : {}),
            ...(fbc ? { fbc } : {}),
            country: [this.hash('bd')],
          },
          custom_data: {
            currency: input.currency ?? 'BDT',
            value: input.total,
            order_id: eventId,
            content_type: 'product',
            ...(contentIds.length ? { content_ids: contentIds } : {}),
            ...(contents.length ? { contents } : {}),
            num_items: order.items.reduce((sum, item) => sum + item.quantity, 0),
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

  private resolveEventSourceUrl(raw: string | null | undefined): string {
    const base = resolveMetaWebUrl().replace(/\/$/, '')
    const value = (raw ?? '').trim()
    if (!value) return base
    if (/^https?:\/\//i.test(value)) return value
    return `${base}${value.startsWith('/') ? value : `/${value}`}`
  }

  /** Meta expects digits-only E.164-style (8801XXXXXXXXX for BD). */
  private normalizeBdPhone(phone?: string): string {
    if (!phone) return ''
    const digits = phone.replace(/\D/g, '')
    if (!digits) return ''
    if (digits.startsWith('880') && digits.length >= 13) return digits
    if (digits.startsWith('0') && digits.length === 11) return `880${digits.slice(1)}`
    if (digits.length === 10 && digits.startsWith('1')) return `880${digits}`
    return digits
  }

  private hash(value: string): string {
    return createHash('sha256').update(value).digest('hex')
  }
}
