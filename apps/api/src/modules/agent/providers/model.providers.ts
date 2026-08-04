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

export class GeminiProvider implements ModelProvider {
  readonly id = 'gemini'

  async chat(
    messages: AgentMessage[],
    tools: AgentToolDefinition[],
    apiKey: string,
    options?: ModelProviderOptions,
  ): Promise<ModelChatResult> {
    const model = options?.model ?? process.env['GEMINI_MODEL'] ?? 'gemini-2.5-pro'
    const system = messages.find((m) => m.role === 'system')?.content ?? ''
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
          // Without this the agent loses its identity, platform knowledge and
          // honesty rules on Gemini — Gemini ignores `system`-role turns.
          ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
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
    options?: ModelProviderOptions,
  ): Promise<ModelChatResult> {
    const model = options?.model ?? process.env['GROK_MODEL'] ?? 'grok-4'
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
