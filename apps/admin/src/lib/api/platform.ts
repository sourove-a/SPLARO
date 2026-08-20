import { apiFetch } from './client'

export function fetchSaaS() {
  return apiFetch<SaaSData>('/admin/platform/saas')
}

export function fetchSecurity() {
  return apiFetch<SecurityData>('/admin/security')
}

export type MediaQuery = {
  cursor?: string
  limit?: number
  q?: string
  type?: 'all' | 'library' | 'product' | 'banner' | 'category'
  folder?: string
}

export function fetchMedia(query: MediaQuery = {}) {
  const params = new URLSearchParams()
  if (query.cursor) params.set('cursor', query.cursor)
  if (query.limit) params.set('limit', String(query.limit))
  if (query.q?.trim()) params.set('q', query.q.trim())
  if (query.type && query.type !== 'all') params.set('type', query.type)
  if (query.folder && query.folder !== 'all') params.set('folder', query.folder)
  const suffix = params.toString()
  return apiFetch<MediaData>(`/admin/platform/media${suffix ? `?${suffix}` : ''}`)
}

export function fetchMarketplace() {
  return apiFetch<MarketplaceData>('/admin/platform/marketplace')
}

export function fetchDeveloper() {
  return apiFetch<DeveloperData>('/admin/platform/developer')
}

export function createApiKey(data: { name: string; scopes?: string[] }) {
  return apiFetch<{
    apiKey: {
      id: string
      name: string
      prefix: string
      scopes: string
      status: string
      lastUsed: string
    }
    rawKey: string
  }>('/admin/platform/api-keys', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function revokeApiKey(id: string) {
  return apiFetch<{ ok: boolean; id: string }>(`/admin/platform/api-keys/${id}`, {
    method: 'DELETE',
  })
}

export function fetchObservability() {
  return apiFetch<ObservabilityData>('/admin/platform/observability')
}

export function fetchIntegrations() {
  return apiFetch<IntegrationsData>('/admin/platform/integrations')
}

export function fetchSystemLogs(params?: { limit?: number; page?: number; q?: string; level?: string }) {
  const qs = new URLSearchParams()
  if (params?.limit) qs.set('limit', String(params.limit))
  if (params?.page) qs.set('page', String(params.page))
  if (params?.q?.trim()) qs.set('q', params.q.trim())
  if (params?.level && params.level !== 'all') qs.set('level', params.level)
  const query = qs.toString()
  return apiFetch<SystemLogsData>(`/admin/platform/system-logs${query ? `?${query}` : ''}`)
}

export function fetchTelegramLogs(limit = 50) {
  return apiFetch<TelegramLogsData>(`/admin/platform/telegram-logs?limit=${limit}`)
}

export interface SaaSData {
  store: {
    id: string
    name: string
    slug: string
    domain: string
    email: string
    isActive: boolean
    currency: string
    timezone: string
    owner: { firstName: string; lastName: string; email: string | null }
  }
  subscription: { plan: string; status: string; periodEnd: string | null; mrr: string }
  stats: { staff: number; stores: number }
  tenants: { id: string; name: string; domain: string; plan: string; users: number; status: string }[]
}

export interface SecurityData {
  kpis: {
    totalAdmins: number
    activeAdmins: number
    twoFaEnabled: number
    activeSessions: number
    logins24h: number
    failedLogins24h: number
    threatLevel: string
  }
  adminUsers: {
    id: string
    name: string
    email: string
    role: string
    status: string
    lastLogin: string
    twoFA: boolean
    telegramLinked?: boolean
    telegramUsername?: string | null
  }[]
  roles: { id: string; name: string; users: number; permissions: string; status: string }[]
  auditLogs: { id: string; actor: string; action: string; target: string; resource: string; time: string; severity: string }[]
  threats: { id: string; action: string; time: string }[]
  posture: { label: string; value: string; ok: boolean }[]
}

export interface MediaData {
  stats: { total: number; library: number; products: number; banners: number; categories: number; missingAlt?: number }
  assets: {
    id: string
    type: string
    name: string
    url: string
    altText: string
    source: string
    updated: string
    publicUrl?: string
    folder?: string
    mimeType?: string | null
    sizeBytes?: number | null
    width?: number | null
    height?: number | null
    productId?: string
    productSlug?: string
    contentHash?: string | null
    kind?: string | null
    focalX?: number | null
    focalY?: number | null
    watermarked?: boolean
    createdAt?: string
    updatedAt?: string
  }[]
  pageInfo?: { nextCursor: string | null; hasMore: boolean }
}

export interface MarketplaceData {
  kpis: { vendors: number; gmv: number; pendingKyc: number; active: number }
  vendors: { id: string; name: string; email: string; status: string; metric: string; updated: string }[]
}

export interface DeveloperData {
  kpis: { apiKeys: number; webhooks: number; automationRules: number; sandbox: boolean }
  apiKeys: { id: string; name: string; prefix: string; status: string; scopes: string; lastUsed: string }[]
  webhooks: { id: string; name: string; status: string; trigger: string; updated: string }[]
}

export interface ObservabilityData {
  kpis: { uptime: string; apiP95: string; errorsPerHour: number; queueLag: number }
  services: { id: string; name: string; status: string; latency: string; updated: string }[]
  cronJobs: { id: string; name: string; status: string; duration: string; updated: string }[]
  backups: { id: string; name: string; status: string; metric: string; updated: string }[]
}

export interface IntegrationsData {
  integrations: { id: string; name: string; status: string; lastSync: string }[]
}

export interface SystemLogsData {
  logs: {
    id: string
    level: 'info' | 'warning' | 'error' | 'critical'
    msg: string
    time: string
    createdAt?: string
  }[]
  total?: number
  page?: number
  pageSize?: number
  totalPages?: number
}

export interface TelegramLogsData {
  logs: {
    id: string
    type: string
    command: string | null
    message: string
    success: boolean
    createdAt: string
    time: string
  }[]
}
