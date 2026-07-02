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

export function testInfrastructureIntegration(provider: 'pathao' | 'redx') {
  return apiFetch<{ ok: boolean; message: string }>(`/admin/integrations/infrastructure/${provider}/test`, {
    method: 'POST',
  })
}
