import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'
import { createHmac } from 'crypto'

export type WebhookEventType =
  | 'order.created'
  | 'order.confirmed'
  | 'order.cancelled'
  | 'order.delivered'
  | 'payment.received'
  | 'payment.failed'
  | 'courier.booked'
  | 'courier.failed'
  | 'product.created'
  | 'product.updated'
  | 'product.low_stock'
  | 'customer.created'
  | 'rma.requested'

export interface WebhookEndpoint {
  url: string
  secret?: string
  events: WebhookEventType[]
  isActive: boolean
}

export interface WebhookPayload {
  event: WebhookEventType
  storeId: string
  timestamp: string
  data: Record<string, unknown>
}

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name)

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Dispatch event to all matching active webhook endpoints for this store.
   * Reads endpoints from store settings JSON field `webhookEndpoints`.
   */
  async dispatch(storeId: string, event: WebhookEventType, data: Record<string, unknown>): Promise<void> {
    const endpoints = await this.getEndpoints(storeId)
    const active = endpoints.filter((e) => e.isActive && e.events.includes(event))

    if (active.length === 0) return

    const payload: WebhookPayload = {
      event,
      storeId,
      timestamp: new Date().toISOString(),
      data,
    }

    await Promise.allSettled(active.map((endpoint) => this.send(endpoint, payload)))
  }

  private async send(endpoint: WebhookEndpoint, payload: WebhookPayload): Promise<void> {
    const body = JSON.stringify(payload)
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-SPLARO-Event': payload.event,
      'X-SPLARO-Timestamp': payload.timestamp,
    }

    if (endpoint.secret) {
      const sig = createHmac('sha256', endpoint.secret).update(body).digest('hex')
      headers['X-SPLARO-Signature'] = `sha256=${sig}`
    }

    try {
      const res = await fetch(endpoint.url, {
        method: 'POST',
        headers,
        body,
        signal: AbortSignal.timeout(10_000),
      })

      if (!res.ok) {
        this.logger.warn(`Webhook ${payload.event} → ${endpoint.url} failed: HTTP ${res.status}`)
      } else {
        this.logger.debug(`Webhook ${payload.event} → ${endpoint.url} delivered`)
      }
    } catch (err) {
      this.logger.error(`Webhook delivery error (${endpoint.url}): ${err instanceof Error ? err.message : 'unknown'}`)
    }
  }

  async getEndpoints(storeId: string): Promise<WebhookEndpoint[]> {
    const settings = await this.prisma.siteSettings.findUnique({
      where: { storeId },
      select: { storefrontConfig: true },
    })
    if (!settings?.storefrontConfig) return []
    const cfg = settings.storefrontConfig as { webhookEndpoints?: WebhookEndpoint[] }
    return cfg.webhookEndpoints ?? []
  }

  async saveEndpoints(storeId: string, endpoints: WebhookEndpoint[]): Promise<void> {
    const settings = await this.prisma.siteSettings.findUnique({
      where: { storeId },
      select: { storefrontConfig: true },
    })
    const existing = (settings?.storefrontConfig as Record<string, unknown>) ?? {}
    const cfg = JSON.parse(JSON.stringify({ ...existing, webhookEndpoints: endpoints })) as object
    await this.prisma.siteSettings.upsert({
      where: { storeId },
      create: { storeId, storefrontConfig: cfg },
      update: { storefrontConfig: cfg },
    })
  }

  async addEndpoint(storeId: string, endpoint: WebhookEndpoint): Promise<WebhookEndpoint[]> {
    const existing = await this.getEndpoints(storeId)
    const updated = [...existing, endpoint]
    await this.saveEndpoints(storeId, updated)
    return updated
  }

  async removeEndpoint(storeId: string, url: string): Promise<WebhookEndpoint[]> {
    const existing = await this.getEndpoints(storeId)
    const updated = existing.filter((e) => e.url !== url)
    await this.saveEndpoints(storeId, updated)
    return updated
  }

  list(storeId: string) {
    return this.getEndpoints(storeId)
  }
}
