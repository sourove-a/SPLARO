import { apiFetch } from '@/lib/api/client'

export interface TelegramIntegration {
  botToken: string | null
  tokenConfigured: boolean
  chatId: string
  isEnabled: boolean
  notifyOrders: boolean
  notifyCustomers: boolean
  notifyPayments: boolean
  notifyCourier: boolean
  notifyStock: boolean
  notifyReviews: boolean
  reportDaily: boolean
  reportTime: string
  lastTestedAt: string | null
  lastTestStatus: string | null
  lastTestMessage: string | null
  updatedAt: string | null
}

export interface TelegramHealth {
  botTokenConfigured: boolean
  botTokenSource: 'env' | 'database' | 'none'
  botRunning: boolean
  botUsername: string | null
  transportMode: 'polling' | 'webhook' | 'send-only' | 'disabled'
  webhookUrl: string | null
  webhookRegistered: boolean
  linkedAdminCount: number
  linkedAdmins: { id: string; telegramIdMasked: string; username: string | null; role: string }[]
  configChatIdMasked: string | null
  hasLinkedAdminChat: boolean
  lastDeliveryStatus: 'success' | 'failed' | 'none'
  lastDeliveryError: string | null
  lastDeliveryAt: string | null
  networkVerified: boolean
  lastTestedAt: string | null
  lastTestStatus: string | null
  lastTestMessage: string | null
}

export interface TelegramLinkToken {
  ok: boolean
  code: string
  email: string
  expiresInSeconds: number
  hint: string
}

export interface TelegramLinkedAdmin {
  id: string
  telegramIdMasked: string
  username: string | null
  role: string
}

export interface AiIntegration {
  provider: 'openai'
  apiKey: string | null
  keyConfigured: boolean
  model: string
  defaultModel: string
  temperature: number
  isEnabled: boolean
  usageLimit: number
  supportedModels: string[]
  lastTestedAt: string | null
  lastTestStatus: string | null
  lastTestMessage: string | null
  updatedAt: string | null
}

export interface IntegrationCard {
  id: string
  name: string
  provider: string
  configurePath: string
  connected: boolean
  connectionDetail?: string | null
  status: 'connected' | 'not_connected' | 'error'
  isEnabled: boolean
  lastTestedAt: string | null
  lastTestStatus: string | null
  lastError: string | null
}

export function fetchIntegrations() {
  return apiFetch<{ integrations: IntegrationCard[] }>('/admin/integrations')
}

export async function testMetaIntegration() {
  return apiFetch<{ ok: boolean; message: string; pixelId?: string }>('/admin/integrations/marketing/meta/test', {
    method: 'POST',
  })
}

export function fetchTelegramIntegration() {
  return apiFetch<TelegramIntegration>('/admin/integrations/telegram')
}

export function updateTelegramIntegration(body: Partial<TelegramIntegration> & { botToken?: string }) {
  return apiFetch<TelegramIntegration>('/admin/integrations/telegram', {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export function testTelegramIntegration(message?: string) {
  return apiFetch<{ ok: boolean; message: string; chatId: string }>('/admin/integrations/telegram/test', {
    method: 'POST',
    body: JSON.stringify({ message }),
  })
}

export function fetchTelegramHealth() {
  return apiFetch<TelegramHealth>('/admin/integrations/telegram/health')
}

export function generateTelegramLinkToken() {
  return apiFetch<TelegramLinkToken>('/admin/integrations/telegram/link-token', { method: 'POST' })
}

export function fetchTelegramLinkedAdmins() {
  return apiFetch<{ configChatIdMasked: string | null; linked: TelegramLinkedAdmin[] }>(
    '/admin/integrations/telegram/linked-admins',
  )
}

export function unlinkTelegramAdmin(id: string) {
  return apiFetch<{ ok: boolean }>(`/admin/integrations/telegram/linked-admins/${id}`, { method: 'DELETE' })
}

export function fetchAiIntegration() {
  return apiFetch<AiIntegration>('/admin/integrations/ai')
}

export function updateAiIntegration(body: {
  apiKey?: string
  model?: string
  defaultModel?: string
  temperature?: number
  isEnabled?: boolean
  usageLimit?: number
}) {
  return apiFetch<AiIntegration>('/admin/integrations/ai', {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export function testAiIntegration(body: {
  apiKey?: string
  model?: string
  defaultModel?: string
  temperature?: number
  testPrompt?: string
}) {
  return apiFetch<{ ok: boolean; message: string; model: string; reply?: string }>(
    '/admin/integrations/ai/test',
    { method: 'POST', body: JSON.stringify(body) },
  )
}

export interface PaymentIntegrationConfig {
  provider: string
  configured: boolean
  source: 'database' | 'env' | 'none'
  adminManaged?: boolean
  fields: Record<string, string | boolean>
  lastTestedAt?: string | null
  lastTestStatus?: string | null
}

export function fetchPaymentIntegrations() {
  return apiFetch<{ items: PaymentIntegrationConfig[] }>('/admin/integrations/payments')
}

export function updatePaymentIntegration(provider: string, body: Record<string, string | boolean>) {
  return apiFetch<PaymentIntegrationConfig>(`/admin/integrations/payments/${provider}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export function testPaymentIntegration(provider: string) {
  return apiFetch<{ ok: boolean; message: string }>(`/admin/integrations/payments/${provider}/test`, {
    method: 'POST',
  })
}

export interface InfrastructureConfig {
  provider: string
  configured: boolean
  source: string
  adminManaged?: boolean
  fields: Record<string, string>
  lastTestedAt?: string | null
  lastTestStatus?: string | null
}

export type InfraProvider = 'cloudflare_r2' | 'steadfast' | 'pathao' | 'redx'

export function fetchInfrastructureConfig(provider: InfraProvider) {
  return apiFetch<InfrastructureConfig>(`/admin/integrations/infrastructure/${provider}`)
}

export function updateInfrastructureConfig(provider: InfraProvider, body: Record<string, string>) {
  return apiFetch<InfrastructureConfig>(`/admin/integrations/infrastructure/${provider}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export function testInfrastructureIntegration(provider: 'steadfast' | 'pathao' | 'redx') {
  return apiFetch<{ ok: boolean; message: string }>(`/admin/integrations/infrastructure/${provider}/test`, {
    method: 'POST',
  })
}
