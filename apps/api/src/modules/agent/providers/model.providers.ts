import Anthropic from '@anthropic-ai/sdk'
import type { AgentMessage, AgentToolCall, AgentToolDefinition, ModelChatResult } from '../agent.types'
import { callOpenAiChat, formatOpenAiMessages } from './openai-models'

export interface ModelProviderOptions {
  /** Model id override (difficulty routing). */
  model?: string
  claude?: {
    authMode?: 'api_key' | 'antigravity_proxy'
    baseUrl?: string
    authToken?: string
  }
}

export interface ModelProvider {
  readonly id: string
  chat(
    messages: AgentMessage[],
    tools: AgentToolDefinition[],
    apiKey: string,
    options?: ModelProviderOptions,
  ): Promise<ModelChatResult>
  streamText(messages: AgentMessage[], apiKey: string, options?: ModelProviderOptions): AsyncGenerator<string>
}

function parseOpenAiToolCalls(raw: unknown): AgentToolCall[] {
  if (!raw || !Array.isArray(raw)) return []
  return raw.map((item, index) => {
    const call = item as { id?: string; function?: { name?: string; arguments?: string } }
    let args: Record<string, unknown> = {}
    try {
      args = JSON.parse(call.function?.arguments ?? '{}') as Record<string, unknown>
    } catch {
      args = {}
    }
    return {
      id: call.id ?? `call_${index}`,
      name: call.function?.name ?? 'unknown',
      arguments: args,
    }
  })
}

export class OpenAiProvider implements ModelProvider {
  readonly id = 'openai'

  async chat(
    messages: AgentMessage[],
    tools: AgentToolDefinition[],
    apiKey: string,
    options?: ModelProviderOptions,
  ): Promise<ModelChatResult> {
    const { response: res } = await callOpenAiChat(
      apiKey,
      {
        messages: formatOpenAiMessages(messages),
        tools: tools.map((t) => ({
          type: 'function',
          function: { name: t.name, description: t.description, parameters: t.parameters },
        })),
        tool_choice: 'auto',
      },
      options?.model,
    )

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string; tool_calls?: unknown } }>
    }
    const message = data.choices?.[0]?.message
    return {
      content: message?.content ?? '',
      toolCalls: parseOpenAiToolCalls(message?.tool_calls),
    }
  }

  async *streamText(
    messages: AgentMessage[],
    apiKey: string,
    options?: ModelProviderOptions,
  ): AsyncGenerator<string> {
    const { response: res } = await callOpenAiChat(
      apiKey,
      {
        stream: true,
        messages: formatOpenAiMessages(messages),
      },
      options?.model,
    )

    if (!res.body) {
      throw new Error('OpenAI stream error: empty response body')
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue
        const payload = trimmed.slice(5).trim()
        if (payload === '[DONE]') return
        try {
          const json = JSON.parse(payload) as {
            choices?: Array<{ delta?: { content?: string } }>
          }
          const token = json.choices?.[0]?.delta?.content
          if (token) yield token
        } catch {
          /* skip malformed chunk */
        }
      }
    }
  }
}

export const DEFAULT_CLAUDE_MODEL = 'claude-opus-5'
const CLAUDE_MAX_TOKENS = 8192

export class ClaudeProvider implements ModelProvider {
  readonly id = 'claude'

  private resolveModel(options?: ModelProviderOptions): string {
    return options?.model ?? process.env['ANTHROPIC_MODEL'] ?? DEFAULT_CLAUDE_MODEL
  }

  /**
   * Supports both a plain API key and the "antigravity proxy" mode, where an
   * ANTHROPIC_BASE_URL fronts the API and auth moves to a bearer token.
   */
  private client(apiKey: string, options?: ModelProviderOptions): Anthropic {
    const baseURL =
      options?.claude?.baseUrl?.trim() || process.env['ANTHROPIC_BASE_URL']?.trim() || undefined
    const mode = options?.claude?.authMode ?? (baseURL ? 'antigravity_proxy' : 'api_key')

    if (mode === 'antigravity_proxy') {
      const authToken =
        options?.claude?.authToken?.trim() ||
        apiKey?.trim() ||
        process.env['ANTHROPIC_AUTH_TOKEN']?.trim() ||
        'test'
      return new Anthropic({ authToken, ...(baseURL ? { baseURL } : {}) })
    }

    return new Anthropic({ apiKey, ...(baseURL ? { baseURL } : {}) })
  }

  /**
   * Anthropic needs real `tool_use` / `tool_result` content blocks, and every
   * `tool_result` must ride on a user turn. Consecutive tool messages are merged
   * into one user turn, which the API also requires.
   */
  private toMessageParams(messages: AgentMessage[]): Anthropic.MessageParam[] {
    const out: Anthropic.MessageParam[] = []

    for (const message of messages) {
      if (message.role === 'system') continue

      if (message.role === 'tool') {
        if (!message.toolCallId) continue
        const block: Anthropic.ToolResultBlockParam = {
          type: 'tool_result',
          tool_use_id: message.toolCallId,
          content: message.content || '(no output)',
        }
        const previous = out[out.length - 1]
        if (previous?.role === 'user' && Array.isArray(previous.content)) {
          previous.content.push(block)
        } else {
          out.push({ role: 'user', content: [block] })
        }
        continue
      }

      if (message.role === 'assistant' && message.toolCalls?.length) {
        const blocks: Anthropic.ContentBlockParam[] = []
        // An empty text block is rejected — omit it rather than sending ''.
        if (message.content.trim()) blocks.push({ type: 'text', text: message.content })
        for (const call of message.toolCalls) {
          blocks.push({ type: 'tool_use', id: call.id, name: call.name, input: call.arguments })
        }
        out.push({ role: 'assistant', content: blocks })
        continue
      }

      if (!message.content.trim()) continue
      out.push({ role: message.role, content: message.content })
    }

    return out
  }

  private toTools(tools: AgentToolDefinition[]): Anthropic.ToolUnion[] {
    return tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters as Anthropic.Tool.InputSchema,
    }))
  }

  private baseParams(messages: AgentMessage[], options?: ModelProviderOptions) {
    return {
      model: this.resolveModel(options),
      max_tokens: CLAUDE_MAX_TOKENS,
      system: messages.find((m) => m.role === 'system')?.content ?? '',
      messages: this.toMessageParams(messages),
      // Thinking stays off: extended thinking with tool use requires echoing
      // thinking blocks back on the next turn, and AgentMessage has nowhere to
      // carry them. Depth comes from `effort` instead, which is valid at high.
      thinking: { type: 'disabled' } as Anthropic.ThinkingConfigDisabled,
      output_config: { effort: 'high' } as Anthropic.OutputConfig,
    }
  }

  async chat(
    messages: AgentMessage[],
    tools: AgentToolDefinition[],
    apiKey: string,
    options?: ModelProviderOptions,
  ): Promise<ModelChatResult> {
    const response = await this.client(apiKey, options).messages.create({
      ...this.baseParams(messages, options),
      ...(tools.length ? { tools: this.toTools(tools) } : {}),
    })

    if (response.stop_reason === 'refusal') {
      const category = response.stop_details?.category ?? 'policy'
      throw new Error(`Claude declined this request (${category}). Rephrase it or switch model.`)
    }

    let content = ''
    const toolCalls: AgentToolCall[] = []

    for (const block of response.content) {
      if (block.type === 'text') content += block.text
      if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          name: block.name,
          arguments: (block.input ?? {}) as Record<string, unknown>,
        })
      }
    }

    return { content, toolCalls }
  }

  async *streamText(
    messages: AgentMessage[],
    apiKey: string,
    options?: ModelProviderOptions,
  ): AsyncGenerator<string> {
    const stream = this.client(apiKey, options).messages.stream(this.baseParams(messages, options))

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield event.delta.text
      }
    }

    const final = await stream.finalMessage()
    if (final.stop_reason === 'refusal') {
      const category = final.stop_details?.category ?? 'policy'
      throw new Error(`Claude declined this request (${category}). Rephrase it or switch model.`)
    }
  }
}

/**
 * Model names this key can call `generateContent` on.
 *
 * Best effort and only used to decorate a 404 — if the lookup itself fails the
 * caller still gets the original error, which is the one that matters.
 */
async function listGeminiModels(apiKey: string): Promise<string> {
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`)
    if (!res.ok) return ''
    const data = (await res.json()) as {
      models?: Array<{ name?: string; supportedGenerationMethods?: string[] }>
    }
    const usable = (data.models ?? [])
      .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
      .map((m) => (m.name ?? '').replace(/^models\//, ''))
      .filter(Boolean)
    if (usable.length === 0) return ''
    return `. Set GEMINI_MODEL to one of: ${usable.slice(0, 8).join(', ')}`
  } catch {
    return ''
  }
}

export function normalizeGeminiModel(rawModel?: string): string {
  const model = (rawModel ?? '').trim().replace(/^models\//, '')
  if (!model || model === 'gemini-flash' || model === 'gemini-pro') {
    return 'gemini-2.0-flash'
  }
  return model
}

/** Gemini needs functionCall / functionResponse parts — plain text drops the tool loop. */
export function formatGeminiContents(messages: AgentMessage[]): Array<{
  role: 'user' | 'model'
  parts: Array<
    | { text: string }
    | { functionCall: { name: string; args: Record<string, unknown> } }
    | { functionResponse: { name: string; response: { result: string } } }
  >
}> {
  const contents: Array<{
    role: 'user' | 'model'
    parts: Array<
      | { text: string }
      | { functionCall: { name: string; args: Record<string, unknown> } }
      | { functionResponse: { name: string; response: { result: string } } }
    >
  }> = []

  for (const message of messages) {
    if (message.role === 'system') continue

    if (message.role === 'tool') {
      contents.push({
        role: 'user',
        parts: [
          {
            functionResponse: {
              name: message.name ?? 'tool',
              response: { result: message.content || '(no output)' },
            },
          },
        ],
      })
      continue
    }

    if (message.role === 'assistant' && message.toolCalls?.length) {
      const parts: Array<
        | { text: string }
        | { functionCall: { name: string; args: Record<string, unknown> } }
      > = []
      if (message.content.trim()) parts.push({ text: message.content })
      for (const call of message.toolCalls) {
        parts.push({ functionCall: { name: call.name, args: call.arguments } })
      }
      contents.push({ role: 'model', parts })
      continue
    }

    if (!message.content.trim()) continue
    contents.push({
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: message.content }],
    })
  }

  return contents
}

export class GeminiProvider implements ModelProvider {
  readonly id = 'gemini'

  async chat(
    messages: AgentMessage[],
    tools: AgentToolDefinition[],
    apiKey: string,
    options?: ModelProviderOptions,
  ): Promise<ModelChatResult> {
    const primaryModel = normalizeGeminiModel(options?.model ?? process.env['GEMINI_MODEL'])
    const system = messages.find((m) => m.role === 'system')?.content ?? ''
    const contents = formatGeminiContents(messages)

    const reqBody = JSON.stringify({
      contents,
      // Without this the agent loses its identity, platform knowledge and
      // honesty rules on Gemini — Gemini ignores `system`-role turns.
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
      // Only send `tools` when there are some. A toolless call (translation,
      // the product copy generator) would otherwise post
      // `functionDeclarations: []`, which Gemini rejects as INVALID_ARGUMENT
      // rather than treating as "no tools".
      ...(tools.length > 0
        ? {
            tools: [
              {
                functionDeclarations: tools.map((t) => ({
                  name: t.name,
                  description: t.description,
                  parameters: t.parameters,
                })),
              },
            ],
          }
        : {}),
    })

    const candidates = [primaryModel, 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-flash-latest']
    const uniqueCandidates = [...new Set(candidates)]
    let res: Response | null = null
    let activeModel = primaryModel

    for (const cand of uniqueCandidates) {
      activeModel = cand
      res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${activeModel}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: reqBody,
        },
      )
      if (res.ok) break
      // If 503 (high demand) or 404 (not found), try next model in tier
      if (res.status !== 503 && res.status !== 404) break
    }

    if (!res || !res.ok) {
      // A bare status hid the two failures people actually hit — a retired model
      // name and a key without the API enabled — behind an identical "400".
      const detail = res ? await res.text().catch(() => '') : ''
      const reason = detail.slice(0, 300).replace(/\s+/g, ' ').trim()
      // Google retires model names on their own schedule, so a config that
      // worked last quarter starts 404ing. Naming the models this key can
      // actually call turns that into a one-line fix instead of a search.
      const hint = res?.status === 404 ? await listGeminiModels(apiKey) : ''
      throw new Error(
        `Gemini error ${res?.status ?? 500}${reason ? ` — ${reason}` : ''} (model: ${activeModel})${hint}`,
      )
    }
    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string; functionCall?: { name: string; args?: Record<string, unknown> } }> } }>
    }
    const parts = data.candidates?.[0]?.content?.parts ?? []
    let content = ''
    const toolCalls: AgentToolCall[] = []
    for (const part of parts) {
      if (part.text) content += part.text
      if (part.functionCall?.name) {
        toolCalls.push({
          id: `gemini_${toolCalls.length}`,
          name: part.functionCall.name,
          arguments: part.functionCall.args ?? {},
        })
      }
    }
    return { content, toolCalls }
  }

  async *streamText(messages: AgentMessage[], apiKey: string, options?: ModelProviderOptions): AsyncGenerator<string> {
    const result = await this.chat(messages, [], apiKey, options)
    if (result.content) yield result.content
  }
}

export class GrokProvider implements ModelProvider {
  readonly id = 'grok'

  async chat(
    messages: AgentMessage[],
    tools: AgentToolDefinition[],
    apiKey: string,
    options?: ModelProviderOptions,
  ): Promise<ModelChatResult> {
    const model = options?.model ?? process.env['GROK_MODEL'] ?? 'grok-2-latest'
    const res = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: formatOpenAiMessages(messages),
        tools: tools.map((t) => ({
          type: 'function',
          function: { name: t.name, description: t.description, parameters: t.parameters },
        })),
      }),
    })
    if (!res.ok) throw new Error(`Grok error ${res.status}`)
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string; tool_calls?: unknown } }>
    }
    const message = data.choices?.[0]?.message
    return {
      content: message?.content ?? '',
      toolCalls: parseOpenAiToolCalls(message?.tool_calls),
    }
  }

  async *streamText(messages: AgentMessage[], apiKey: string, options?: ModelProviderOptions): AsyncGenerator<string> {
    const result = await this.chat(messages, [], apiKey, options)
    if (result.content) yield result.content
  }
}

const MANUS_BASE = 'https://api.manus.ai/v2'
const MANUS_POLL_MS = 2_500
const MANUS_TIMEOUT_MS = 180_000

/**
 * Manus has no sync chat/completions API — it runs async tasks.
 * We create a task, poll assistant messages, and return text only
 * (no SPLARO tool_calls; mandatory pre-reads still inject live data into messages).
 */
export class ManusProvider implements ModelProvider {
  readonly id = 'manus'

  private flattenPrompt(messages: AgentMessage[]): string {
    const parts: string[] = [
      'You are answering inside SPLARO Command (Bangladesh fashion eCommerce admin).',
      'Reply in clear Bangla/Banglish/English matching the user. Be concrete.',
      'If VERIFIED LIVE DATA appears below, use only that for counts/status — do not invent.',
      'You cannot call SPLARO order/courier tools yourself; answer from the prompt context.',
      '',
    ]
    for (const m of messages) {
      if (!m.content?.trim()) continue
      const role = m.role === 'assistant' ? 'Assistant' : m.role === 'system' ? 'System' : m.role === 'tool' ? 'Tool' : 'User'
      parts.push(`${role}:\n${m.content.trim()}`)
    }
    return parts.join('\n\n').slice(0, 48_000)
  }

  private async manusFetch(
    apiKey: string,
    endpoint: string,
    init: { method: 'GET' | 'POST'; query?: Record<string, string | number>; body?: unknown },
  ): Promise<Record<string, unknown>> {
    const url = new URL(`${MANUS_BASE}/${endpoint}`)
    for (const [k, v] of Object.entries(init.query ?? {})) {
      url.searchParams.set(k, String(v))
    }
    const res = await fetch(url, {
      method: init.method,
      headers: {
        'x-manus-api-key': apiKey,
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      },
      signal: AbortSignal.timeout(30_000),
      ...(init.body ? { body: JSON.stringify(init.body) } : {}),
    })
    const payload = (await res.json().catch(() => ({}))) as {
      ok?: boolean
      error?: { code?: string; message?: string }
    } & Record<string, unknown>
    if (!res.ok || payload.ok === false) {
      const code = payload.error?.code ?? String(res.status)
      const message = payload.error?.message ?? res.statusText
      throw new Error(`Manus ${endpoint} → ${code}: ${message}`)
    }
    return payload
  }

  private extractAssistantText(messages: Array<Record<string, unknown>>): {
    text: string
    status: string | null
  } {
    const texts: string[] = []
    let status: string | null = null
    for (const event of messages) {
      const type = String(event['type'] ?? '')
      const payload = (event[type] ?? {}) as Record<string, unknown>
      if (type === 'assistant_message') {
        const content = payload['content']
        if (typeof content === 'string' && content.trim()) texts.push(content.trim())
      }
      if (type === 'status_update') {
        const agentStatus = payload['agent_status']
        if (typeof agentStatus === 'string') status = agentStatus
      }
    }
    return { text: texts.join('\n\n').trim(), status }
  }

  async chat(
    messages: AgentMessage[],
    _tools: AgentToolDefinition[],
    apiKey: string,
    options?: ModelProviderOptions,
  ): Promise<ModelChatResult> {
    const profile = options?.model ?? process.env['MANUS_AGENT_PROFILE'] ?? 'manus-1.6-lite'
    const prompt = this.flattenPrompt(messages)
    const created = await this.manusFetch(apiKey, 'task.create', {
      method: 'POST',
      body: {
        message: { content: prompt },
        agent_profile: profile,
      },
    })
    const taskId = String(created['task_id'] ?? '')
    if (!taskId) throw new Error('Manus task.create returned no task_id')

    const deadline = Date.now() + MANUS_TIMEOUT_MS
    let lastText = ''
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, MANUS_POLL_MS))
      const listed = await this.manusFetch(apiKey, 'task.listMessages', {
        method: 'GET',
        query: { task_id: taskId, limit: 100, order: 'asc' },
      })
      const events = (listed['messages'] as Array<Record<string, unknown>>) ?? []
      const { text, status } = this.extractAssistantText(events)
      if (text) lastText = text
      if (status === 'stopped' || status === 'error') {
        if (status === 'error' && !lastText) {
          throw new Error(`Manus task ${taskId} ended in error`)
        }
        return { content: lastText || 'Manus finished with no text reply.', toolCalls: [] }
      }
    }

    if (lastText) return { content: `${lastText}\n\n(Manus still running — partial reply.)`, toolCalls: [] }
    throw new Error(`Manus task ${taskId} timed out after ${MANUS_TIMEOUT_MS / 1000}s — try again or use Claude/OpenAI for fast ops.`)
  }

  async *streamText(
    messages: AgentMessage[],
    apiKey: string,
    options?: ModelProviderOptions,
  ): AsyncGenerator<string> {
    const result = await this.chat(messages, [], apiKey, options)
    if (result.content) yield result.content
  }
}

export const DEFAULT_OPENROUTER_MODEL = 'openai/gpt-4o-mini'

export class OpenRouterProvider implements ModelProvider {
  readonly id = 'openrouter'

  private resolveModel(options?: ModelProviderOptions): string {
    return options?.model ?? process.env['OPENROUTER_MODEL'] ?? DEFAULT_OPENROUTER_MODEL
  }

  async chat(
    messages: AgentMessage[],
    tools: AgentToolDefinition[],
    apiKey: string,
    options?: ModelProviderOptions,
  ): Promise<ModelChatResult> {
    const model = this.resolveModel(options)
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://splaro.co',
        'X-Title': 'SPLARO Command',
      },
      body: JSON.stringify({
        model,
        messages: formatOpenAiMessages(messages),
        ...(tools.length
          ? {
              tools: tools.map((t) => ({
                type: 'function',
                function: { name: t.name, description: t.description, parameters: t.parameters },
              })),
              tool_choice: 'auto',
            }
          : {}),
      }),
    })

    if (!res.ok) {
      const err = await res.text().catch(() => '')
      throw new Error(`OpenRouter error ${res.status}: ${err || res.statusText}`)
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string; tool_calls?: unknown } }>
    }
    const message = data.choices?.[0]?.message
    return {
      content: message?.content ?? '',
      toolCalls: parseOpenAiToolCalls(message?.tool_calls),
    }
  }

  async *streamText(
    messages: AgentMessage[],
    apiKey: string,
    options?: ModelProviderOptions,
  ): AsyncGenerator<string> {
    const model = this.resolveModel(options)
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://splaro.co',
        'X-Title': 'SPLARO Command',
      },
      body: JSON.stringify({
        model,
        stream: true,
        messages: formatOpenAiMessages(messages),
      }),
    })

    if (!res.ok) {
      const err = await res.text().catch(() => '')
      throw new Error(`OpenRouter stream error ${res.status}: ${err || res.statusText}`)
    }

    if (!res.body) throw new Error('OpenRouter stream error: empty response body')

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue
        const payload = trimmed.slice(5).trim()
        if (payload === '[DONE]') return
        try {
          const json = JSON.parse(payload) as {
            choices?: Array<{ delta?: { content?: string } }>
          }
          const token = json.choices?.[0]?.delta?.content
          if (token) yield token
        } catch {
          /* skip */
        }
      }
    }
  }
}
