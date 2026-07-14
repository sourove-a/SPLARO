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
import { AgentLoopService } from './agent-loop.service'
import { AgentAuditService } from './agent-audit.service'
import { AgentCostService } from './agent-cost.service'
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
    private readonly loop: AgentLoopService,
    private readonly audit: AgentAuditService,
    private readonly cost: AgentCostService,
  ) {}

  async *chatStream(
    storeIdRaw: string,
    sessionId: string,
    userMessage: string,
    createdBy?: string,
    context?: string,
    channel: 'admin' | 'telegram' = 'admin',
  ): AsyncGenerator<AgentStreamEvent> {
    const storeId = await resolveStoreId(this.prisma, storeIdRaw)
    const trimmed = userMessage.trim()
    if (!trimmed) {
      yield { type: 'error', content: 'Message cannot be empty' }
      return
    }

    await this.conversations.append(storeId, sessionId, 'user', trimmed)

    this.router.invalidateCache()

    const history = sanitizeAgentHistory(await this.conversations.getHistory(storeId, sessionId))
    const systemPrompt = await this.prompts.getSystemPrompt(storeId)
    const fullSystem = context ? `${systemPrompt}\n\nCONTEXT:\n${context}` : systemPrompt

    const generator = this.loop.run({
      storeId,
      sessionId,
      userMessage: trimmed,
      systemPrompt: fullSystem,
      history: history as AgentMessage[],
      createdBy,
      channel,
    })

    let finalText = ''
    let done = false
    while (!done) {
      const next = await generator.next()
      if (next.done) {
        const result = next.value
        if (result?.finalText) finalText = result.finalText
        done = true
        break
      }
      const event = next.value
      if (event.type === 'token' && event.content) finalText += event.content
      yield event
    }

    if (finalText.trim()) {
      await this.conversations.append(storeId, sessionId, 'assistant', finalText)
    }
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
    const integrationKeyMap: Partial<Record<(typeof keyFields)[number], string>> = {
      openaiKey: 'openai',
      claudeKey: 'claude',
      geminiKey: 'gemini',
      grokKey: 'grok',
    }

    for (const field of keyFields) {
      const raw = body[field]
      if (raw !== undefined && raw !== '' && !String(raw).includes('••••')) {
        const plain = String(raw)
        data[field] = this.crypto.encrypt(plain)
        const provider = integrationKeyMap[field]
        if (provider) {
          await this.integrations.upsertSecret({
            storeId,
            provider,
            key: 'apiKey',
            plain,
          })
          if (provider === 'openai') {
            await this.integrations.recordTest({
              storeId,
              provider: 'openai',
              success: true,
              message: 'API key saved via AI Command Brain',
            })
          }
        }
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

    await this.prisma.agentConfig.upsert({
      where: { storeId },
      create: { storeId, systemPrompt: DEFAULT_AGENT_SYSTEM_PROMPT, ...data },
      update: data,
    })

    this.router.invalidateCache()

    const modelStatus = await this.router.getModelStatus(storeId)
    if (!modelStatus.activeModelReady) {
      throw new BadRequestException(
        `Active model "${modelStatus.activeModel}" has no API key. Save a key for that model or pick another active model.`,
      )
    }

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

    let database = true
    try {
      await this.prisma.$queryRaw`SELECT 1`
    } catch {
      database = false
    }

    const spentUsd = await this.cost.getDailySpendUsd(storeId)
    const limitUsd = this.cost.dailyCostLimitUsd()
    const pct = limitUsd > 0 ? Math.min(1, spentUsd / limitUsd) : 0

    return {
      api: true,
      database,
      ...modelStatus,
      telegram: {
        configured: Boolean(telegram.token && telegram.chatId),
        isActive: telegram.isActive,
        chatId: telegram.chatId,
      },
      budget: {
        spentUsd,
        limitUsd,
        pct,
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

  listActivity(storeIdRaw: string, limit?: number) {
    return resolveStoreId(this.prisma, storeIdRaw).then((storeId) =>
      this.audit.listActivity(storeId, limit ?? 50),
    )
  }

  private async isTelegramChatAllowed(storeId: string, chatId: string): Promise<boolean> {
    const cfg = await this.prisma.agentConfig.findUnique({ where: { storeId } })
    const allowed = cfg?.telegramAllowedIds?.trim()
    if (!allowed) return true
    const ids = allowed.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean)
    return ids.includes(String(chatId))
  }

  async handleTelegramMessage(
    storeIdRaw: string,
    chatId: string,
    text: string,
  ): Promise<{ reply: string; confirmRequired: boolean }> {
    const storeId = await resolveStoreId(this.prisma, storeIdRaw)

    if (!(await this.isTelegramChatAllowed(storeId, chatId))) {
      return { reply: 'Unauthorized — chat ID not in telegramAllowedIds', confirmRequired: false }
    }

    const telegramUser = await this.prisma.telegramUser.findFirst({
      where: {
        telegramId: String(chatId),
        isActive: true,
        config: { storeId, isActive: true },
      },
      select: { role: true },
    })

    if (!telegramUser || !['SUPER_ADMIN', 'MANAGER'].includes(telegramUser.role)) {
      return { reply: 'Unauthorized', confirmRequired: false }
    }

    const sessionId = `telegram:${chatId}`
    let reply = ''
    let confirmRequired = false

    for await (const event of this.chatStream(storeId, sessionId, text, undefined, undefined, 'telegram')) {
      if (event.type === 'token' && event.content) reply += event.content
      if (event.type === 'confirm_required') confirmRequired = true
      if (event.type === 'error') return { reply: event.content ?? 'Error', confirmRequired: false }
      if (event.type === 'budget_exceeded') {
        return { reply: event.content ?? 'Budget exceeded', confirmRequired: false }
      }
    }

    return { reply: reply.slice(0, 3000) || 'Done.', confirmRequired }
  }
}
