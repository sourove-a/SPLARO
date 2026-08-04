import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../../../common/prisma.service'
import { resolveStoreId } from '../../../common/store.util'
import { EncryptionService } from '../../integrations/encryption.service'
import { IntegrationsService } from '../../integrations/integrations.service'
import { ensureAgentConfigRow } from '../agent-store.util'
import type { AgentModelId } from '../agent.types'
import {
  ClaudeProvider,
  GeminiProvider,
  GrokProvider,
  ManusProvider,
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
    manus: new ManusProvider(),
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
      const configured = (['claude', 'gemini', 'grok', 'openai', 'manus'] as AgentModelId[]).filter(
        (m) => cfg.keys[m],
      )
      const hint =
        configured.length > 0
          ? ` Configured: ${configured.join(', ')} — AI Command Brain e active model switch koro.`
          : ' AI Command Brain e oi model er API key save koro.'
      const envName =
        model === 'claude'
          ? 'ANTHROPIC'
          : model === 'openai'
            ? 'OPENAI'
            : model === 'gemini'
              ? 'GEMINI'
              : model === 'manus'
                ? 'MANUS'
                : 'GROK'
      throw new Error(
        `Active model "${model}" er API key nai.${hint} (env: ${envName}_API_KEY)`,
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
    if (model === 'manus') {
      const explicit = await this.resolveExplicitModel(storeId, 'manus')
      return { model: explicit ?? process.env['MANUS_AGENT_PROFILE'] ?? 'manus-1.6-lite' }
    }
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
      manus: { configured: Boolean(cfg.keys.manus) },
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

    // An operator-chosen model wins over difficulty routing. Without this the
    // cheap tier applies to everything except COMPLEX_PATTERN matches, so the
    // model picked in AI Command Brain almost never takes effect.
    const storeId = await resolveStoreId(this.prisma, storeIdRaw)
    if (await this.resolveExplicitModel(storeId, base.model)) return base

    const options: ModelProviderOptions = { ...(base.providerOptions ?? {}), model: cheap }

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
      case 'manus': {
        const key = this.config.get<string>('MANUS_API_KEY')?.trim()
        if (!key || /paste|your-|example|changeme|todo|replace/i.test(key) || key.length < 20) return null
        return key
      }
      default:
        return null
    }
  }

  private async resolveOpenAiModel(storeId: string): Promise<string> {
    return (await this.resolveExplicitModel(storeId, 'openai')) ?? DEFAULT_OPENAI_MODEL
  }

  /**
   * The model an operator actually chose, or null when we're only falling back to
   * a default. Difficulty routing must not override an explicit choice.
   */
  private async resolveExplicitModel(storeId: string, model: AgentModelId): Promise<string | null> {
    const map = await this.integrations.getProviderMap(storeId, model)
    const fromDb = map.model ?? map.defaultModel
    if (fromDb) return String(fromDb)
    const envVar =
      model === 'openai'
        ? 'OPENAI_MODEL'
        : model === 'claude'
          ? 'ANTHROPIC_MODEL'
          : model === 'gemini'
            ? 'GEMINI_MODEL'
            : model === 'manus'
              ? 'MANUS_AGENT_PROFILE'
              : 'GROK_MODEL'
    return this.config.get<string>(envVar)?.trim() || null
  }

  private decryptKey(stored: string | null | undefined): string | null {
    if (!stored) return null
    try {
      return this.crypto.decrypt(stored)
    } catch {
      // Never treat ciphertext as a usable API key.
      return stored.startsWith('enc:') ? null : stored
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

    // Concurrent health probes can race on first create — use race-safe helper.
    const row = await ensureAgentConfigRow(this.prisma, storeId)

    const keys: Record<AgentModelId, string | null> = {
      openai: await this.resolveKey(storeId, 'openai', row.openaiKey),
      claude: await this.resolveClaudeKey(storeId, row.claudeKey),
      gemini: await this.resolveKey(storeId, 'gemini', row.geminiKey),
      grok: await this.resolveKey(storeId, 'grok', row.grokKey),
      manus: await this.resolveKey(storeId, 'manus', row.manusKey),
    }

    const activeModel = (row.activeModel as AgentModelId) || 'claude'
    // Never silently switch providers — Telegram + admin must match AI Command Brain.
    // Missing key is handled in getProvider() with a clear error.

    this.cache = { at: now, storeId, activeModel, keys }
    return this.cache
  }
}
