import { apiFetch } from './client'

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

export interface WebhookLogItem {
  id: string
  action: string
  resource: string
  resourceId: string | null
  newData: {
    url?: string
    status?: number
    ok?: boolean
    error?: string
    timestamp?: string
    events?: string[]
    [key: string]: unknown
  } | null
  createdAt: string
}

export interface WebhookLogsResponse {
  items: WebhookLogItem[]
  total: number
  page: number
  limit: number
}

export interface WebhookStatsResponse {
  period: string
  totalDispatched: number
  byEvent: Array<{ event: string; count: number }>
}

export function fetchWebhooks(): Promise<WebhookEndpoint[]> {
  return apiFetch<WebhookEndpoint[]>('/admin/webhooks')
}

export function createWebhook(data: {
  url: string
  secret?: string
  events: WebhookEventType[]
  isActive?: boolean
}): Promise<WebhookEndpoint[]> {
  return apiFetch<WebhookEndpoint[]>('/admin/webhooks', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function updateWebhook(
  url: string,
  data: {
    newUrl?: string
    secret?: string
    events?: WebhookEventType[]
    isActive?: boolean
  },
): Promise<{ ok: boolean; endpoint: WebhookEndpoint }> {
  return apiFetch<{ ok: boolean; endpoint: WebhookEndpoint }>(
    `/admin/webhooks?url=${encodeURIComponent(url)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(data),
    },
  )
}

export function deleteWebhook(url: string): Promise<WebhookEndpoint[]> {
  return apiFetch<WebhookEndpoint[]>(`/admin/webhooks?url=${encodeURIComponent(url)}`, {
    method: 'DELETE',
  })
}

export function testWebhook(event?: WebhookEventType): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>('/admin/webhooks/test', {
    method: 'POST',
    body: JSON.stringify({ event }),
  })
}

export function dispatchWebhook(
  event: WebhookEventType,
  data?: Record<string, unknown>,
): Promise<{ ok: boolean; event: WebhookEventType }> {
  return apiFetch<{ ok: boolean; event: WebhookEventType }>('/admin/webhooks/dispatch', {
    method: 'POST',
    body: JSON.stringify({ event, data }),
  })
}

export function fetchWebhookLogs(params?: {
  page?: number
  limit?: number
  event?: string
}): Promise<WebhookLogsResponse> {
  const query = new URLSearchParams()
  if (params?.page) query.set('page', String(params.page))
  if (params?.limit) query.set('limit', String(params.limit))
  if (params?.event) query.set('event', params.event)
  const qs = query.toString()
  return apiFetch<WebhookLogsResponse>(`/admin/webhooks/logs${qs ? `?${qs}` : ''}`)
}

export function fetchWebhookStats(days?: number): Promise<WebhookStatsResponse> {
  const qs = days ? `?days=${days}` : ''
  return apiFetch<WebhookStatsResponse>(`/admin/webhooks/stats${qs}`)
}

export function fetchWebhookEvents(): Promise<{ events: WebhookEventType[] }> {
  return apiFetch<{ events: WebhookEventType[] }>('/admin/webhooks/events')
}
