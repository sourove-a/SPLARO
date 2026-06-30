import type { AgentMessage } from '../agent.types'

export const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini'

/** Models tried in order when the preferred model is unavailable on the OpenAI project. */
export const OPENAI_MODELS = [
  'gpt-4o-mini',
  'gpt-4o',
  'gpt-4-turbo',
  'gpt-4',
  'gpt-3.5-turbo',
] as const

export type OpenAiModelId = (typeof OPENAI_MODELS)[number]

export function openAiModelCandidates(preferred?: string | null): string[] {
  const fromEnv = process.env['OPENAI_MODEL']?.trim()
  const primary = preferred?.trim() || fromEnv || DEFAULT_OPENAI_MODEL
  const ordered = [primary, ...OPENAI_MODELS.filter((m) => m !== primary)]
  return [...new Set(ordered)]
}

export function isOpenAiModelAccessError(status: number, body: string): boolean {
  if (status === 403 || status === 404) return true
  return /does not have access to model|model_not_found|invalid_model|model_not_available/i.test(body)
}

export interface OpenAiChatMessage {
  role: string
  content: string | null
  tool_call_id?: string
  tool_calls?: Array<{
    id: string
    type: 'function'
    function: { name: string; arguments: string }
  }>
}

export function formatOpenAiMessages(messages: AgentMessage[]): OpenAiChatMessage[] {
  return messages
    .filter((m) => m.role !== 'tool' || Boolean(m.toolCallId))
    .map((m) => {
      if (m.role === 'tool') {
        return {
          role: 'tool',
          content: m.content,
          tool_call_id: m.toolCallId!,
        }
      }
      if (m.role === 'assistant' && m.toolCalls?.length) {
        return {
          role: 'assistant',
          content: m.content || null,
          tool_calls: m.toolCalls.map((tc) => ({
            id: tc.id,
            type: 'function' as const,
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.arguments),
            },
          })),
        }
      }
      return { role: m.role, content: m.content }
    })
}

/** Drop tool-role rows from persisted history (tool turns are not stored completely). */
export function sanitizeAgentHistory(messages: AgentMessage[]): AgentMessage[] {
  return messages.filter((m) => m.role !== 'tool')
}

export interface OpenAiChatPayload {
  model: string
  messages: OpenAiChatMessage[]
  tools?: Array<{ type: 'function'; function: Record<string, unknown> }>
  tool_choice?: 'auto'
  stream?: boolean
  temperature?: number
  max_tokens?: number
}

export async function callOpenAiChat(
  apiKey: string,
  payload: Omit<OpenAiChatPayload, 'model'>,
  preferredModel?: string | null,
): Promise<{ response: Response; modelUsed: string }> {
  const candidates = openAiModelCandidates(preferredModel)
  let lastError = 'OpenAI: no accessible model found'

  for (const model of candidates) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...payload, model }),
    })

    if (res.ok) return { response: res, modelUsed: model }

    const errText = await res.text()
    lastError = `OpenAI error ${res.status}: ${errText.slice(0, 300)}`
    if (!isOpenAiModelAccessError(res.status, errText)) {
      throw new Error(lastError)
    }
  }

  throw new Error(lastError)
}
