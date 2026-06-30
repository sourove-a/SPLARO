import type { AgentMessage, AgentToolCall, AgentToolDefinition, ModelChatResult } from '../agent.types'
import { callOpenAiChat, formatOpenAiMessages } from './openai-models'

export interface ModelProviderOptions {
  /** OpenAI model id (e.g. gpt-4o-mini). Ignored by non-OpenAI providers. */
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

export class ClaudeProvider implements ModelProvider {
  readonly id = 'claude'

  private resolveEndpoint(options?: ModelProviderOptions): string {
    const base =
      options?.claude?.baseUrl?.trim() ||
      process.env['ANTHROPIC_BASE_URL']?.trim() ||
      'https://api.anthropic.com'
    const normalized = base.replace(/\/+$/, '')
    if (normalized.endsWith('/v1/messages')) return normalized
    if (normalized.endsWith('/v1')) return `${normalized}/messages`
    return `${normalized}/v1/messages`
  }

  private resolveHeaders(apiKey: string, options?: ModelProviderOptions): Record<string, string> {
    const mode =
      options?.claude?.authMode ??
      (process.env['ANTHROPIC_BASE_URL'] ? 'antigravity_proxy' : 'api_key')

    if (mode === 'antigravity_proxy') {
      const token =
        options?.claude?.authToken?.trim() ||
        apiKey?.trim() ||
        process.env['ANTHROPIC_AUTH_TOKEN']?.trim() ||
        'test'
      return {
        Authorization: `Bearer ${token}`,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      }
    }

    return {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    }
  }

  async chat(
    messages: AgentMessage[],
    tools: AgentToolDefinition[],
    apiKey: string,
    options?: ModelProviderOptions,
  ): Promise<ModelChatResult> {
    const model = process.env['ANTHROPIC_MODEL'] ?? 'claude-sonnet-4-20250514'
    const system = messages.find((m) => m.role === 'system')?.content ?? ''
    const chatMessages = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role === 'tool' ? 'user' : m.role, content: m.content }))

    const res = await fetch(this.resolveEndpoint(options), {
      method: 'POST',
      headers: this.resolveHeaders(apiKey, options),
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system,
        messages: chatMessages,
        tools: tools.map((t) => ({
          name: t.name,
          description: t.description,
          input_schema: t.parameters,
        })),
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Claude error ${res.status}: ${err.slice(0, 200)}`)
    }

    const data = (await res.json()) as {
      content?: Array<{ type: string; text?: string; name?: string; input?: Record<string, unknown>; id?: string }>
    }

    let content = ''
    const toolCalls: AgentToolCall[] = []

    for (const block of data.content ?? []) {
      if (block.type === 'text' && block.text) content += block.text
      if (block.type === 'tool_use' && block.name) {
        toolCalls.push({
          id: block.id ?? `tool_${toolCalls.length}`,
          name: block.name,
          arguments: block.input ?? {},
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

export class GeminiProvider implements ModelProvider {
  readonly id = 'gemini'

  async chat(
    messages: AgentMessage[],
    tools: AgentToolDefinition[],
    apiKey: string,
    _options?: ModelProviderOptions,
  ): Promise<ModelChatResult> {
    const model = process.env['GEMINI_MODEL'] ?? 'gemini-1.5-pro'
    const contents = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }))

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          tools: [{ functionDeclarations: tools.map((t) => ({ name: t.name, description: t.description, parameters: t.parameters })) }],
        }),
      },
    )

    if (!res.ok) throw new Error(`Gemini error ${res.status}`)
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
    _options?: ModelProviderOptions,
  ): Promise<ModelChatResult> {
    const model = process.env['GROK_MODEL'] ?? 'grok-beta'
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
