import { BadRequestException, Injectable } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'
import { DEFAULT_AGENT_SYSTEM_PROMPT } from '../agent/prompts/system.prompt'
import { DEFAULT_OPENAI_MODEL, OPENAI_MODELS, callOpenAiChat } from '../agent/providers/openai-models'
import { EncryptionService } from './encryption.service'
import { IntegrationAuditService } from './integration-audit.service'
import { IntegrationsService } from './integrations.service'

export { OPENAI_MODELS }

export interface AiIntegrationDto {
  apiKey?: string
  model?: string
  defaultModel?: string
  temperature?: number
  isEnabled?: boolean
  usageLimit?: number
  testPrompt?: string
}

@Injectable()
export class AiIntegrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly integrations: IntegrationsService,
    private readonly crypto: EncryptionService,
    private readonly audit: IntegrationAuditService,
  ) {}

  async get(storeIdRaw: string) {
    const storeId = await this.integrations.resolveStore(storeIdRaw)
    const agent = await this.prisma.agentConfig.findUnique({ where: { storeId } })
    const keySaved = await this.integrations.hasSecret(storeId, 'openai', 'apiKey')
    const meta = await this.integrations.getProviderMeta(storeId, 'openai')
    const map = await this.integrations.getProviderMap(storeId, 'openai')

    const model = String(map.model ?? map.defaultModel ?? agent?.activeModel ?? DEFAULT_OPENAI_MODEL)
    const temperature = map.temperature != null ? Number(map.temperature) : 0.7
    const usageLimit = map.usageLimit != null ? Number(map.usageLimit) : 0
    const isEnabled = map.isEnabled != null ? Boolean(map.isEnabled) : true

    return {
      provider: 'openai' as const,
      apiKey: keySaved ? this.crypto.mask('sk-placeholder') : null,
      keyConfigured: keySaved || Boolean(agent?.openaiKey),
      model,
      defaultModel: String(map.defaultModel ?? model),
      temperature,
      isEnabled,
      usageLimit,
      supportedModels: OPENAI_MODELS,
      lastTestedAt: meta.lastTestedAt,
      lastTestStatus: meta.lastTestStatus,
      lastTestMessage: meta.lastTestMessage,
      updatedAt: agent?.updatedAt?.toISOString() ?? null,
    }
  }

  async update(storeIdRaw: string, body: AiIntegrationDto, userId?: string) {
    const storeId = await this.integrations.resolveStore(storeIdRaw)
    const keySaved = await this.integrations.hasSecret(storeId, 'openai', 'apiKey')
    const newKey = body.apiKey?.trim()

    if (newKey && !this.crypto.isMaskedInput(newKey)) {
      await this.integrations.upsertSecret({
        storeId,
        provider: 'openai',
        key: 'apiKey',
        plain: newKey,
        userId,
      })
    } else if (!keySaved) {
      const agent = await this.prisma.agentConfig.findUnique({ where: { storeId } })
      if (!agent?.openaiKey) {
        throw new BadRequestException('OpenAI API key is required')
      }
    }

    const model = body.defaultModel ?? body.model ?? DEFAULT_OPENAI_MODEL
    const temperature = body.temperature ?? 0.7

    if (body.isEnabled !== undefined) {
      await this.integrations.upsertPlain({ storeId, provider: 'openai', key: 'isEnabled', value: body.isEnabled, userId })
    }
    if (body.usageLimit !== undefined) {
      await this.integrations.upsertPlain({ storeId, provider: 'openai', key: 'usageLimit', value: body.usageLimit, userId })
    }
    await this.integrations.upsertPlain({ storeId, provider: 'openai', key: 'model', value: model, userId })
    await this.integrations.upsertPlain({ storeId, provider: 'openai', key: 'defaultModel', value: model, userId })
    await this.integrations.upsertPlain({ storeId, provider: 'openai', key: 'temperature', value: temperature, userId })

    const plainKey =
      newKey && !this.crypto.isMaskedInput(newKey)
        ? newKey
        : (await this.integrations.getPlain(storeId, 'openai', 'apiKey')) ??
          (await this.getLegacyOpenAiKey(storeId))

    if (!plainKey) {
      throw new BadRequestException('OpenAI API key is required')
    }

    const encryptedKey = this.crypto.encrypt(plainKey)

    await this.prisma.agentConfig.upsert({
      where: { storeId },
      create: {
        storeId,
        systemPrompt: DEFAULT_AGENT_SYSTEM_PROMPT,
        activeModel: 'openai',
        openaiKey: encryptedKey,
      },
      update: {
        activeModel: 'openai',
        openaiKey: encryptedKey,
      },
    })

    await this.audit.logSave({
      storeId,
      userId,
      provider: 'openai',
      resource: 'ai_integration',
      newData: {
        model,
        temperature,
        isEnabled: body.isEnabled ?? true,
        keyUpdated: Boolean(newKey && !this.crypto.isMaskedInput(newKey)),
      },
    })

    return this.get(storeId)
  }

  private async getLegacyOpenAiKey(storeId: string): Promise<string | null> {
    const agent = await this.prisma.agentConfig.findUnique({ where: { storeId } })
    if (!agent?.openaiKey) return null
    try {
      return this.crypto.decrypt(agent.openaiKey)
    } catch {
      return agent.openaiKey
    }
  }

  async resolveApiKey(storeId: string): Promise<string | null> {
    return (
      (await this.integrations.getPlain(storeId, 'openai', 'apiKey')) ??
      (await this.getLegacyOpenAiKey(storeId))
    )
  }

  async test(storeIdRaw: string, body: AiIntegrationDto, userId?: string) {
    const storeId = await this.integrations.resolveStore(storeIdRaw)
    const apiKey =
      body.apiKey && !this.crypto.isMaskedInput(body.apiKey)
        ? body.apiKey.trim()
        : await this.resolveApiKey(storeId)

    if (!apiKey) {
      throw new BadRequestException('OpenAI API key not configured. Save key first.')
    }

    const cfg = await this.get(storeIdRaw)
    const model = body.defaultModel ?? body.model ?? cfg.defaultModel ?? DEFAULT_OPENAI_MODEL
    const prompt = (body.testPrompt ?? 'Reply with exactly: SPLARO AI OK').slice(0, 500)

    let modelUsed = model
    let res: Response
    try {
      const result = await callOpenAiChat(
        apiKey,
        {
          temperature: body.temperature ?? cfg.temperature ?? 0.7,
          max_tokens: 64,
          messages: [
            { role: 'system', content: 'You are a connectivity test assistant.' },
            { role: 'user', content: prompt },
          ],
        },
        model,
      )
      res = result.response
      modelUsed = result.modelUsed
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'OpenAI API error'
      await this.integrations.recordTest({ storeId, provider: 'openai', success: false, message: errMsg, userId })
      await this.audit.logTest({ storeId, userId, provider: 'openai', success: false, message: errMsg })
      throw new BadRequestException(errMsg)
    }

    const payload = (await res.json().catch(() => ({}))) as {
      error?: { message?: string }
      choices?: { message?: { content?: string } }[]
    }

    if (!res.ok) {
      const errMsg = payload.error?.message ?? `OpenAI API error (${res.status})`
      await this.integrations.recordTest({ storeId, provider: 'openai', success: false, message: errMsg, userId })
      await this.audit.logTest({ storeId, userId, provider: 'openai', success: false, message: errMsg })
      throw new BadRequestException(errMsg)
    }

    const reply = payload.choices?.[0]?.message?.content?.trim() ?? ''
    const msg = reply
      ? `OpenAI responded (${modelUsed}): ${reply.slice(0, 120)}`
      : `OpenAI connected successfully (${modelUsed})`
    await this.integrations.recordTest({ storeId, provider: 'openai', success: true, message: msg, userId })
    await this.audit.logTest({ storeId, userId, provider: 'openai', success: true, message: msg })

    return { ok: true, message: msg, model: modelUsed, reply }
  }
}
