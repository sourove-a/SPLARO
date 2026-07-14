export type AgentModelId = 'openai' | 'gemini' | 'claude' | 'grok'

export type AgentMessageRole = 'user' | 'assistant' | 'tool' | 'system'

export interface AgentMessage {
  role: AgentMessageRole
  content: string
  toolCallId?: string
  name?: string
  /** Present on assistant messages that invoked tools (required for OpenAI follow-up turns). */
  toolCalls?: AgentToolCall[]
}

export interface AgentToolDefinition {
  name: string
  description: string
  parameters: Record<string, unknown>
}

export interface AgentToolCall {
  id: string
  name: string
  arguments: Record<string, unknown>
}

export interface ModelChatResult {
  content: string
  toolCalls: AgentToolCall[]
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

export interface AgentHealthSnapshot {
  ordersToday: number
  revenueToday: number
  lowStockCount: number
  seoGapCount: number
  topCustomer: { name: string; orders: number; spend: number } | null
}
