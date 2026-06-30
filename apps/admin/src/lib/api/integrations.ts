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
