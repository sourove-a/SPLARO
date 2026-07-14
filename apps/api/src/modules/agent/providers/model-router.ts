import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../../../common/prisma.service'
import { resolveStoreId } from '../../../common/store.util'
import { EncryptionService } from '../../integrations/encryption.service'
import { IntegrationsService } from '../../integrations/integrations.service'
import { DEFAULT_AGENT_SYSTEM_PROMPT } from '../prompts/system.prompt'
import type { AgentModelId } from '../agent.types'
import {
  ClaudeProvider,
  GeminiProvider,
  GrokProvider,
  OpenAiProvider,
  type ModelProvider,
  type ModelProviderOptions,
} from './model.providers'
import { DEFAULT_OPENAI_MODEL } from './openai-models'
import { cheapModelForProvider } from '../agent-difficulty'

const CONFIG_CACHE_MS = 60_000

interface CachedConfig {
  at: number
  storeId: string
  activeModel: AgentModelId
  keys: Record<AgentModelId, string | null>
}

@Injectable()
export class ModelRouter {
  private readonly logger = new Logger(ModelRouter.name)
  private cache: CachedConfig | null = null

  private readonly providers: Record<AgentModelId, ModelProvider> = {
    openai: new OpenAiProvider(),
    claude: new ClaudeProvider(),
    gemini: new GeminiProvider(),
    grok: new GrokProvider(),
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly crypto: EncryptionService,
    private readonly integrations: IntegrationsService,
  ) {}

  async getProvider(storeIdRaw: string): Promise<{
    provider: ModelProvider
    apiKey: string
    model: AgentModelId
    providerOptions?: ModelProviderOptions
  }> {
    const storeId = await resolveStoreId(this.prisma, storeIdRaw)
    const cfg = await this.loadConfig(storeId)
    const model = cfg.activeModel
    const apiKey = cfg.keys[model]

    if (!apiKey) {
      const configured = (['openai', 'claude', 'gemini', 'grok'] as AgentModelId[]).filter((m) => cfg.keys[m])
      const hint =
        configured.length > 0
          ? ` Configured models: ${configured.join(', ')} — switch active model in AI Command Brain.`
          : ''
      throw new Error(
        `No API key for ${model}. Add it in AI Command Brain (/dashboard/ai-agent) or set ${model === 'claude' ? 'ANTHROPIC' : model === 'openai' ? 'OPENAI' : model === 'gemini' ? 'GEMINI' : 'GROK'}_API_KEY in .env.${hint}`,
      )
    }

    const providerOptions = await this.resolveProviderOptions(storeId, model)

    return { provider: this.providers[model], apiKey, model, providerOptions }
  }

  private async resolveProviderOptions(
    storeId: string,
    model: AgentModelId,
  ): Promise<ModelProviderOptions | undefined> {
    if (model === 'openai') return { model: await this.resolveOpenAiModel(storeId) }
    if (model === 'claude') return { claude: await this.resolveClaudeOptions(storeId) }
    return undefined
  }

  private async resolveClaudeOptions(storeId: string): Promise<NonNullable<ModelProviderOptions['claude']>> {
    const map = await this.integrations.getProviderMap(storeId, 'claude')
    const envBase = this.config.get<string>('ANTHROPIC_BASE_URL')?.trim()
    const authMode =
      map.authMode === 'antigravity_proxy' || (!map.authMode && envBase)
        ? ('antigravity_proxy' as const)
        : ('api_key' as const)

    return {
      authMode,
      baseUrl: String(map.baseUrl ?? envBase ?? '').trim() || undefined,
      authToken:
        (await this.integrations.getPlain(storeId, 'claude', 'authToken')) ??
        this.config.get<string>('ANTHROPIC_AUTH_TOKEN') ??
        undefined,
    }
  }

  private async resolveClaudeKey(storeId: string, rowKey: string | null): Promise<string | null> {
    const opts = await this.resolveClaudeOptions(storeId)
    if (opts.authMode === 'antigravity_proxy' && opts.baseUrl) {
      return opts.authToken?.trim() || 'test'
    }
    const fromIntegration = await this.integrations.getPlain(storeId, 'claude', 'apiKey')
    if (fromIntegration) return fromIntegration
    const decrypted = this.decryptKey(rowKey)
    if (decrypted) return decrypted
    return this.envKey('claude')
  }

  async getActiveModel(storeIdRaw: string): Promise<AgentModelId> {
    const storeId = await resolveStoreId(this.prisma, storeIdRaw)
    const cfg = await this.loadConfig(storeId)
    return cfg.activeModel
  }

  async getModelStatus(storeIdRaw: string) {
    const storeId = await resolveStoreId(this.prisma, storeIdRaw)
    const cfg = await this.loadConfig(storeId)
    const models = {
      openai: { configured: Boolean(cfg.keys.openai) },
      claude: { configured: Boolean(cfg.keys.claude) },
      gemini: { configured: Boolean(cfg.keys.gemini) },
      grok: { configured: Boolean(cfg.keys.grok) },
    }
    return {
      activeModel: cfg.activeModel,
      models,
      activeModelReady: Boolean(cfg.keys[cfg.activeModel]),
    }
  }

  invalidateCache() {
    this.cache = null
  }

  async getProviderForDifficulty(
    storeIdRaw: string,
    difficulty: import('../agent-difficulty').AgentDifficulty,
  ): Promise<{
    provider: ModelProvider
    apiKey: string
    model: AgentModelId
    providerOptions?: ModelProviderOptions
  }> {
    const base = await this.getProvider(storeIdRaw)
    if (difficulty === 'complex') return base

    const cheap = cheapModelForProvider(base.model)
    if (!cheap) return base

    const options: ModelProviderOptions = { ...(base.providerOptions ?? {}) }
    if (cheap) options.model = cheap

    return { ...base, providerOptions: options }
  }

  private envKey(model: AgentModelId): string | null {
    switch (model) {
      case 'openai':
        return this.config.get<string>('OPENAI_API_KEY') ?? null
      case 'claude':
        return this.config.get<string>('ANTHROPIC_API_KEY') ?? null
      case 'gemini':
        return this.config.get<string>('GEMINI_API_KEY') ?? null
      case 'grok':
        return this.config.get<string>('GROK_API_KEY') ?? null
      default:
        return null
    }
  }

  private async resolveOpenAiModel(storeId: string): Promise<string> {
    const map = await this.integrations.getProviderMap(storeId, 'openai')
    const fromDb = map.model ?? map.defaultModel
    if (fromDb) return String(fromDb)
    return this.config.get<string>('OPENAI_MODEL') ?? DEFAULT_OPENAI_MODEL
  }

  private decryptKey(stored: string | null | undefined): string | null {
    if (!stored) return null
    try {
      return this.crypto.decrypt(stored)
    } catch {
      return stored
    }
  }

  private async resolveKey(storeId: string, model: AgentModelId, rowKey: string | null): Promise<string | null> {
    const fromIntegration = await this.integrations.getPlain(storeId, model === 'openai' ? 'openai' : model, 'apiKey')
    if (fromIntegration) return fromIntegration
    const decrypted = this.decryptKey(rowKey)
    if (decrypted) return decrypted
    return this.envKey(model)
  }

  private async loadConfig(storeId: string): Promise<CachedConfig> {
    const now = Date.now()
    if (this.cache && this.cache.storeId === storeId && now - this.cache.at < CONFIG_CACHE_MS) {
      return this.cache
    }

    // Concurrent health probes can race on first create — use upsert.
    const row = await this.prisma.agentConfig.upsert({
      where: { storeId },
      create: { storeId, systemPrompt: DEFAULT_AGENT_SYSTEM_PROMPT },
      update: {},
    })

    const keys: Record<AgentModelId, string | null> = {
      openai: await this.resolveKey(storeId, 'openai', row.openaiKey),
      claude: await this.resolveClaudeKey(storeId, row.claudeKey),
      gemini: await this.resolveKey(storeId, 'gemini', row.geminiKey),
      grok: await this.resolveKey(storeId, 'grok', row.grokKey),
    }

    const activeModelRaw = (row.activeModel as AgentModelId) || 'claude'
    let activeModel = activeModelRaw
    if (!keys[activeModel]) {
      const fallback = (['openai', 'claude', 'gemini', 'grok'] as AgentModelId[]).find((m) => keys[m])
      if (fallback) {
        this.logger.warn(`Active model ${activeModel} has no key; using ${fallback}`)
        activeModel = fallback
        void this.prisma.agentConfig
          .update({ where: { storeId }, data: { activeModel: fallback } })
          .catch((err) => this.logger.warn(`Could not persist activeModel fallback: ${err}`))
      }
    }

    this.cache = { at: now, storeId, activeModel, keys }
    return this.cache
  }
}
