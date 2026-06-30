import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../../common/prisma.service'
import { resolveStoreId } from '../../common/store.util'
import { EncryptionService } from '../integrations/encryption.service'
import { IntegrationsService } from '../integrations/integrations.service'
import { DEFAULT_AGENT_SYSTEM_PROMPT } from './prompts/system.prompt'
import { PromptManager } from './prompts/prompt.manager'
import { ConversationStore } from './memory/conversation.store'
import { ModelRouter } from './providers/model-router'
import { sanitizeAgentHistory } from './providers/openai-models'
import { AgentToolsService } from './tools/agent-tools.service'
import { AGENT_TOOL_DEFINITIONS } from './tools/agent-tools.definitions'
import type { AgentMessage, AgentModelId, AgentStreamEvent } from './agent.types'

function maskKey(key: string | null | undefined): string | null {
  if (!key) return null
  if (key.length <= 8) return '••••'
  return `${key.slice(0, 4)}••••${key.slice(-4)}`
}

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly prompts: PromptManager,
    private readonly conversations: ConversationStore,
    private readonly router: ModelRouter,
    private readonly tools: AgentToolsService,
    private readonly config: ConfigService,
    private readonly crypto: EncryptionService,
    private readonly integrations: IntegrationsService,
  ) {}

  async *chatStream(
    storeIdRaw: string,
    sessionId: string,
    userMessage: string,
    createdBy?: string,
    context?: string,
  ): AsyncGenerator<AgentStreamEvent> {
    const storeId = await resolveStoreId(this.prisma, storeIdRaw)
    const trimmed = userMessage.trim()
    if (!trimmed) {
      yield { type: 'error', content: 'Message cannot be empty' }
      return
    }

    await this.conversations.append(storeId, sessionId, 'user', trimmed)

    const history = sanitizeAgentHistory(await this.conversations.getHistory(storeId, sessionId))
    const systemPrompt = await this.prompts.getSystemPrompt(storeId)
    const messages: AgentMessage[] = [
      { role: 'system', content: context ? `${systemPrompt}\n\nCONTEXT:\n${context}` : systemPrompt },
      ...history,
    ]

    const { provider, apiKey, providerOptions } = await this.router.getProvider(storeId)
    let iterations = 0
    let finalText = ''

    while (iterations < 5) {
      iterations += 1
      let result
      try {
        result = await provider.chat(messages, AGENT_TOOL_DEFINITIONS, apiKey, providerOptions)
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Model request failed'
        this.logger.error(msg)
        yield { type: 'error', content: msg }
        return
      }

      if (result.toolCalls.length === 0) {
        finalText = result.content
        break
      }

      messages.push({
        role: 'assistant',
        content: result.content ?? '',
        toolCalls: result.toolCalls,
      })

      for (const call of result.toolCalls) {
        yield { type: 'tool_start', toolName: call.name }
        let toolResult: unknown
        try {
          toolResult = await this.tools.execute(storeId, sessionId, call.name, call.arguments, createdBy)
        } catch (err) {
          toolResult = { error: err instanceof Error ? err.message : 'Tool failed' }
        }
        yield { type: 'tool_end', toolName: call.name, toolResult: toolResult }
        messages.push({
          role: 'tool',
          content: JSON.stringify(toolResult),
          name: call.name,
          toolCallId: call.id,
        })
      }
    }

    if (!finalText) {
      try {
        for await (const token of provider.streamText(messages, apiKey, providerOptions)) {
          finalText += token
          yield { type: 'token', content: token }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Response stream failed'
        this.logger.error(msg)
        yield { type: 'error', content: msg }
        return
      }
    } else {
      for (const char of finalText) {
        yield { type: 'token', content: char }
      }
    }

    await this.conversations.append(storeId, sessionId, 'assistant', finalText)
    yield { type: 'done' }
  }

  async getConfig(storeIdRaw: string) {
    const storeId = await resolveStoreId(this.prisma, storeIdRaw)
    const row = await this.prisma.agentConfig.upsert({
      where: { storeId },
      create: { storeId, systemPrompt: DEFAULT_AGENT_SYSTEM_PROMPT },
      update: {},
    })

    const claudeMap = await this.integrations.getProviderMap(storeId, 'claude')
    const claudeTokenSaved = await this.integrations.hasSecret(storeId, 'claude', 'authToken')

    return {
      activeModel: row.activeModel,
      openaiKey: maskKey(row.openaiKey),
      geminiKey: maskKey(row.geminiKey),
      claudeKey: maskKey(row.claudeKey),
      grokKey: maskKey(row.grokKey),
      claudeAuthMode: claudeMap.authMode === 'antigravity_proxy' ? 'antigravity_proxy' : 'api_key',
      claudeBaseUrl: String(claudeMap.baseUrl ?? ''),
      claudeAuthToken: claudeTokenSaved ? maskKey('token') : null,
      telegramBotToken: maskKey(row.telegramBotToken),
      telegramChatId: row.telegramChatId,
      telegramAllowedIds: row.telegramAllowedIds,
      systemPrompt: row.systemPrompt,
      updatedAt: row.updatedAt,
    }
  }

  async updateConfig(storeIdRaw: string, body: Record<string, unknown>) {
    const storeId = await resolveStoreId(this.prisma, storeIdRaw)
    const data: Record<string, unknown> = {}

    if (body.activeModel) data.activeModel = String(body.activeModel)
    if (body.systemPrompt) data.systemPrompt = String(body.systemPrompt)
    if (body.telegramChatId !== undefined) data.telegramChatId = body.telegramChatId ? String(body.telegramChatId) : null
    if (body.telegramAllowedIds !== undefined) data.telegramAllowedIds = body.telegramAllowedIds ? String(body.telegramAllowedIds) : null

    const keyFields = ['openaiKey', 'geminiKey', 'claudeKey', 'grokKey', 'telegramBotToken'] as const
    for (const field of keyFields) {
      if (body[field] !== undefined && body[field] !== '' && !String(body[field]).includes('••••')) {
        data[field] = String(body[field])
      }
    }

    if (body.claudeAuthMode !== undefined) {
      await this.integrations.upsertPlain({
        storeId,
        provider: 'claude',
        key: 'authMode',
        value: String(body.claudeAuthMode),
      })
    }
    if (body.claudeBaseUrl !== undefined) {
      await this.integrations.upsertPlain({
        storeId,
        provider: 'claude',
        key: 'baseUrl',
        value: String(body.claudeBaseUrl).trim(),
      })
    }
    const claudeAuthToken = body.claudeAuthToken ? String(body.claudeAuthToken).trim() : ''
    if (claudeAuthToken && !claudeAuthToken.includes('••••')) {
      await this.integrations.upsertSecret({
        storeId,
        provider: 'claude',
        key: 'authToken',
        plain: claudeAuthToken,
      })
    }

    const row = await this.prisma.agentConfig.upsert({
      where: { storeId },
      create: { storeId, systemPrompt: DEFAULT_AGENT_SYSTEM_PROMPT, ...data },
      update: data,
    })

    this.router.invalidateCache()
    return this.getConfig(storeId)
  }

  async switchModel(storeIdRaw: string, model: AgentModelId) {
    const status = await this.router.getModelStatus(storeIdRaw)
    const ready = status.models[model]?.configured
    if (!ready) {
      throw new BadRequestException(`No API key configured for ${model}. Add it in AI Command Brain.`)
    }
    return this.updateConfig(storeIdRaw, { activeModel: model })
  }

  private async resolveTelegram(storeId: string) {
    const tg = await this.prisma.telegramConfig.findUnique({ where: { storeId } })
    let token: string | null = null
    if (tg?.botToken) {
      try {
        token = this.crypto.decrypt(tg.botToken)
      } catch {
        token = tg.botToken
      }
    }
    if (!token) {
      token = this.config.get<string>('TELEGRAM_BOT_TOKEN')?.trim() || null
    }
    return {
      token,
      chatId: tg?.chatId?.trim() || null,
      isActive: tg?.isActive ?? false,
    }
  }

  async getStatus(storeIdRaw: string) {
    const storeId = await resolveStoreId(this.prisma, storeIdRaw)
    const modelStatus = await this.router.getModelStatus(storeId)
    const telegram = await this.resolveTelegram(storeId)

    return {
      api: true,
      database: true,
      ...modelStatus,
      telegram: {
        configured: Boolean(telegram.token && telegram.chatId),
        isActive: telegram.isActive,
        chatId: telegram.chatId,
      },
    }
  }

  async testTelegram(storeIdRaw: string, body: { message?: string }) {
    const storeId = await resolveStoreId(this.prisma, storeIdRaw)
    const telegram = await this.resolveTelegram(storeId)

    if (!telegram.token) {
      throw new BadRequestException('Configure bot token in Telegram Bot settings first.')
    }
    if (!telegram.chatId) {
      throw new BadRequestException('Configure chat ID in Telegram Bot settings first.')
    }

    const text = (body.message ?? '✅ SPLARO — Telegram test message delivered.').slice(0, 4000)
    const res = await fetch(`https://api.telegram.org/bot${telegram.token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: telegram.chatId, text }),
    })

    const payload = (await res.json().catch(() => ({}))) as { ok?: boolean; description?: string }
    if (!res.ok || !payload.ok) {
      throw new BadRequestException(payload.description ?? `Telegram API error (${res.status})`)
    }

    return { ok: true, delivered: true, chatId: telegram.chatId }
  }

  async getHistory(storeIdRaw: string, sessionId: string) {
    const storeId = await resolveStoreId(this.prisma, storeIdRaw)
    return this.conversations.getHistory(storeId, sessionId)
  }

  async clearSession(storeIdRaw: string, sessionId: string) {
    const storeId = await resolveStoreId(this.prisma, storeIdRaw)
    await this.conversations.clearSession(storeId, sessionId)
    return { ok: true }
  }

  getHealth(storeIdRaw: string) {
    return this.tools.getHealthSnapshot(storeIdRaw)
  }

  listPromptVersions(storeIdRaw: string) {
    return this.prompts.listVersions(storeIdRaw)
  }

  async handleTelegramMessage(storeIdRaw: string, chatId: string, text: string): Promise<string> {
    const storeId = await resolveStoreId(this.prisma, storeIdRaw)
    const telegramUser = await this.prisma.telegramUser.findFirst({
      where: {
        telegramId: String(chatId),
        isActive: true,
        config: { storeId, isActive: true },
      },
      select: { role: true },
    })

    if (!telegramUser || !['SUPER_ADMIN', 'MANAGER'].includes(telegramUser.role)) {
      return 'Unauthorized'
    }

    const sessionId = `telegram:${chatId}`
    let reply = ''

    for await (const event of this.chatStream(storeId, sessionId, text)) {
      if (event.type === 'token' && event.content) reply += event.content
      if (event.type === 'error') return event.content ?? 'Error'
    }

    return reply.slice(0, 3000) || 'Done.'
  }
}
