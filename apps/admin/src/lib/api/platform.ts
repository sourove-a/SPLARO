import { apiFetch } from './client'

export function fetchSaaS() {
  return apiFetch<SaaSData>('/admin/platform/saas')
}

export function fetchSecurity() {
  return apiFetch<SecurityData>('/admin/security')
}

export function fetchMedia() {
  return apiFetch<MediaData>('/admin/platform/media')
}

export function fetchMarketplace() {
  return apiFetch<MarketplaceData>('/admin/platform/marketplace')
}

export function fetchDeveloper() {
  return apiFetch<DeveloperData>('/admin/platform/developer')
}

export function fetchObservability() {
  return apiFetch<ObservabilityData>('/admin/platform/observability')
}

export function fetchIntegrations() {
  return apiFetch<IntegrationsData>('/admin/platform/integrations')
}

export function fetchSystemLogs(limit = 50) {
  return apiFetch<SystemLogsData>(`/admin/platform/system-logs?limit=${limit}`)
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
    failedLogins24h: number
    threatLevel: string
  }
  adminUsers: { id: string; name: string; email: string; role: string; status: string; lastLogin: string; twoFA: boolean }[]
  roles: { id: string; name: string; users: number; permissions: string; status: string }[]
  auditLogs: { id: string; actor: string; action: string; target: string; resource: string; time: string; severity: string }[]
  threats: { id: string; action: string; time: string }[]
  posture: { label: string; value: string; ok: boolean }[]
}

export interface MediaData {
  stats: { total: number; products: number; banners: number; categories: number }
  assets: { id: string; type: string; name: string; url: string; altText: string; source: string; updated: string }[]
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
  logs: { id: string; level: 'info' | 'warn' | 'error'; msg: string; time: string }[]
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
