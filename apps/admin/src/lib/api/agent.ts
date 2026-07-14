import { apiFetch, buildAdminApiUrl } from './client'
import { getAdminApiToken } from '@/lib/auth/api-token'
import type { AgentModelId } from './agent.types'

export type { AgentModelId }

export interface AgentHealthSnapshot {
  ordersToday: number
  revenueToday: number
  lowStockCount: number
  seoGapCount: number
  topCustomer: { name: string; orders: number; spend: number } | null
}

export interface AgentConfigResponse {
  activeModel: AgentModelId
  openaiKey: string | null
  geminiKey: string | null
  claudeKey: string | null
  grokKey: string | null
  claudeAuthMode?: 'api_key' | 'antigravity_proxy'
  claudeBaseUrl?: string
  claudeAuthToken?: string | null
  telegramBotToken: string | null
  telegramChatId: string | null
  telegramAllowedIds: string | null
  systemPrompt: string
  updatedAt: string
}

export interface AgentMessage {
  role: 'user' | 'assistant' | 'tool' | 'system'
  content: string
}

function parseApiError(body: string): string {
  try {
    const json = JSON.parse(body) as { message?: string | string[] }
    if (Array.isArray(json.message)) return json.message.join(', ')
    if (json.message) return json.message
  } catch {
    /* plain text */
  }
  return body || 'Request failed'
}

export interface AgentStatusResponse {
  api: boolean
  database: boolean
  activeModel: AgentModelId
  activeModelReady: boolean
  models: Record<AgentModelId, { configured: boolean }>
  telegram: { configured: boolean; isActive?: boolean; chatId: string | null }
  budget?: { spentUsd: number; limitUsd: number; pct: number }
}

export interface AgentStreamEvent {
  type: 'token' | 'tool_start' | 'tool_end' | 'error' | 'done' | 'confirm_required' | 'cost' | 'budget_exceeded'
  content?: string
  toolName?: string
  toolResult?: unknown
  pendingId?: string
  tokenInEst?: number
  tokenOutEst?: number
  costEstUsd?: number
}

export interface AgentActivityToolCall {
  id: string
  toolName: string
  tier: string
  confirmed: boolean
  resultSummary: string
  createdAt: string
}

export interface AgentActivityRun {
  id: string
  sessionId: string
  channel: string
  model: string
  difficulty: string | null
  status: string
  userMessage: string
  tokenInEst: number
  tokenOutEst: number
  costEstUsd: number
  startedAt: string
  finishedAt: string | null
  toolCalls: AgentActivityToolCall[]
}

function agentUrl(path: string, storeId?: string) {
  return buildAdminApiUrl(path, storeId)
}

export async function fetchAgentHealth(storeId?: string) {
  return apiFetch<AgentHealthSnapshot>(
    '/agent/health',
    storeId ? { storeId } : {},
  )
}

export async function fetchAgentStatus(storeId?: string) {
  const res = await fetch(agentUrl('/agent/status', storeId), {
    headers: authHeaders(),
    credentials: 'include',
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(parseApiError(body))
  }
  return res.json() as Promise<AgentStatusResponse>
}

export async function testAgentTelegram(body: { message?: string }, storeId?: string) {
  const res = await fetch(agentUrl('/agent/telegram/test', storeId), {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(parseApiError(text))
  }
  return res.json() as Promise<{ ok: boolean; delivered: boolean; chatId: string }>
}

export async function fetchAgentConfig(storeId?: string) {
  const res = await fetch(agentUrl('/agent/config', storeId), {
    headers: authHeaders(),
    credentials: 'include',
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(parseApiError(body))
  }
  return res.json() as Promise<AgentConfigResponse>
}

export async function updateAgentConfig(body: Partial<AgentConfigResponse>, storeId?: string) {
  const res = await fetch(agentUrl('/agent/config', storeId), {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(parseApiError(text))
  }
  return res.json() as Promise<AgentConfigResponse>
}

export async function switchAgentModel(model: AgentModelId, storeId?: string) {
  const res = await fetch(agentUrl('/agent/model', storeId), {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ model }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(parseApiError(text))
  }
  return res.json() as Promise<AgentConfigResponse>
}

export async function fetchAgentActivity(storeId?: string, limit = 50) {
  const qs = new URLSearchParams({ limit: String(limit) })
  const res = await fetch(agentUrl(`/agent/activity?${qs}`, storeId), {
    headers: authHeaders(),
    credentials: 'include',
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(parseApiError(body))
  }
  return res.json() as Promise<AgentActivityRun[]>
}

export async function fetchAgentHistory(sessionId: string, storeId?: string) {
  const res = await fetch(agentUrl(`/agent/chat/${encodeURIComponent(sessionId)}`, storeId), {
    headers: authHeaders(),
    credentials: 'include',
  })
  if (!res.ok) throw new Error('Failed to load chat history')
  return res.json() as Promise<AgentMessage[]>
}

export async function clearAgentSession(sessionId: string, storeId?: string) {
  const res = await fetch(agentUrl(`/agent/sessions/${encodeURIComponent(sessionId)}`, storeId), {
    method: 'DELETE',
    headers: authHeaders(),
    credentials: 'include',
  })
  if (!res.ok) throw new Error('Failed to clear session')
  return res.json()
}

function authHeaders(): Record<string, string> {
  const token = getAdminApiToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function streamAgentChat(
  params: {
    sessionId: string
    message: string
    context?: string
    storeId?: string
    onEvent: (event: AgentStreamEvent) => void
    signal?: AbortSignal
  },
): Promise<void> {
  const { sessionId, message, context, storeId, onEvent, signal } = params
  const res = await fetch(agentUrl('/agent/chat', storeId), {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    credentials: 'include',
    ...(signal ? { signal } : {}),
    body: JSON.stringify({ sessionId, message, stream: true, context }),
  })

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => 'Chat failed')
    onEvent({ type: 'error', content: parseApiError(text) })
    return
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  let done = false
  while (!done) {
    const chunk = await reader.read()
    done = chunk.done
    if (!chunk.value) continue
    buffer += decoder.decode(chunk.value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      try {
        const event = JSON.parse(line.slice(6)) as AgentStreamEvent
        onEvent(event)
      } catch {
        /* ignore malformed chunk */
      }
    }
  }
}
