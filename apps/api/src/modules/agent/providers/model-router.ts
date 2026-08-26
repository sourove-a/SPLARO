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
  OpenRouterProvider,
  type ModelProvider,
  type ModelProviderOptions,
} from './model.providers'
import { DEFAULT_OPENAI_MODEL } from './openai-models'
import { usableAiSecret } from './ai-key.util'
import { cheapModelForProvider } from '../agent-difficulty'

const CONFIG_CACHE_MS = 60_000

export type ConcreteModelId = Exclude<AgentModelId, 'auto'>

/** Where a key came from — an operator-saved key outranks a leftover .env one. */
type KeySource = 'db' | 'env'

interface ResolvedKey {
  key: string | null
  source: KeySource | null
}

interface CachedConfig {
  at: number
  storeId: string
  activeModel: AgentModelId
  keys: Record<ConcreteModelId, string | null>
  sources: Record<ConcreteModelId, KeySource | null>
}

const PROVIDER_PRIORITY: ConcreteModelId[] = [
  'openrouter',
  'openai',
  'gemini',
  'claude',
  'grok',
  'manus',
]

@Injectable()
export class ModelRouter {
  private readonly logger = new Logger(ModelRouter.name)
  private cache: CachedConfig | null = null

  private readonly providers: Record<ConcreteModelId, ModelProvider> = {
    openrouter: new OpenRouterProvider(),
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

  /**
   * A key an operator saved in AI Command Brain beats one that is only sitting
   * in `.env`: a stale `OPENROUTER_API_KEY` used to win every fallback and
   * answer with a 401 for a provider the operator never picked.
   */
  private pickFallback(cfg: CachedConfig): ConcreteModelId | null {
    const ready = PROVIDER_PRIORITY.filter((m) => Boolean(cfg.keys[m]))
    return ready.find((m) => cfg.sources[m] === 'db') ?? ready[0] ?? null
  }

  async getProvider(storeIdRaw: string): Promise<{
    provider: ModelProvider
    apiKey: string
    model: AgentModelId
    providerOptions?: ModelProviderOptions
    /** Set when the active model had no key and another provider took over. */
    fallbackFrom?: ConcreteModelId
  }> {
    const storeId = await resolveStoreId(this.prisma, storeIdRaw)
    const cfg = await this.loadConfig(storeId)
    let selectedModel: ConcreteModelId
    let fallbackFrom: ConcreteModelId | undefined

    if (cfg.activeModel === 'auto') {
      // In auto mode, find the first available provider with a configured key
      const available = this.pickFallback(cfg)
      if (!available) {
        throw new Error(
          'No AI API key configured. AI Command Brain (or .env) e OpenRouter, OpenAI, Gemini, Claude, Grok ba Manus API key save koro.',
        )
      }
      selectedModel = available
      this.logger.log(`[Auto-Agent] Routed to ${selectedModel}`)
    } else {
      const target = cfg.activeModel as ConcreteModelId
      const apiKey = cfg.keys[target]
      if (apiKey) {
        selectedModel = target
      } else {
        // Fallback: If configured model has no key, look for any ready provider
        const fallback = this.pickFallback(cfg)
        if (fallback) {
          selectedModel = fallback
          fallbackFrom = target
          this.logger.warn(
            `[Auto-Fallback] Active model "${target}" lacks key — fallback to ${fallback}`,
          )
        } else {
          const envName =
            target === 'openrouter'
              ? 'OPENROUTER'
              : target === 'claude'
                ? 'ANTHROPIC'
                : target === 'openai'
                  ? 'OPENAI'
                  : target === 'gemini'
                    ? 'GEMINI'
                    : target === 'manus'
                      ? 'MANUS'
                      : 'GROK'
          throw new Error(
            `Active model "${target}" er API key nai. AI Command Brain e oi model er API key save koro (env: ${envName}_API_KEY), ba "Auto" mode select koro.`,
          )
        }
      }
    }

    const apiKey = cfg.keys[selectedModel]!
    const providerOptions = await this.resolveProviderOptions(storeId, selectedModel)

    return {
      provider: this.providers[selectedModel],
      apiKey,
      model: selectedModel,
      providerOptions,
      ...(fallbackFrom ? { fallbackFrom } : {}),
    }
  }

  /**
   * Active model first, then every other provider that has a key.
   * ChatGPT / Gemini / Claude can all answer if any one of them is configured.
   */
  async getFailoverChain(
    storeIdRaw: string,
    difficulty: import('../agent-difficulty').AgentDifficulty,
  ): Promise<
    Array<{
      provider: ModelProvider
      apiKey: string
      model: AgentModelId
      providerOptions?: ModelProviderOptions
      fallbackFrom?: ConcreteModelId
    }>
  > {
    const primary = await this.getProviderForDifficulty(storeIdRaw, difficulty)
    const storeId = await resolveStoreId(this.prisma, storeIdRaw)
    const cfg = await this.loadConfig(storeId)
    const chain = [primary]
    // Operator-saved keys are tried before .env-only ones, same reason as pickFallback.
    const rest = PROVIDER_PRIORITY.filter((id) => id !== primary.model && cfg.keys[id]).sort(
      (a, b) => Number(cfg.sources[b] === 'db') - Number(cfg.sources[a] === 'db'),
    )
    for (const id of rest) {
      const apiKey = cfg.keys[id]
      if (!apiKey) continue
      chain.push({
        provider: this.providers[id],
        apiKey,
        model: id,
        providerOptions: await this.withDifficultyOptions(storeId, id, difficulty),
      })
    }
    return chain
  }

  private async withDifficultyOptions(
    storeId: string,
    model: ConcreteModelId,
    difficulty: import('../agent-difficulty').AgentDifficulty,
  ): Promise<ModelProviderOptions | undefined> {
    const base = await this.resolveProviderOptions(storeId, model)
    if (difficulty === 'complex') return base
    const cheap = cheapModelForProvider(model)
    if (!cheap) return base
    if (await this.resolveExplicitModel(storeId, model)) return base
    return { ...(base ?? {}), model: cheap }
  }

  private async resolveProviderOptions(
    storeId: string,
    model: ConcreteModelId,
  ): Promise<ModelProviderOptions | undefined> {
    if (model === 'openrouter') {
      const explicit = await this.resolveExplicitModel(storeId, 'openrouter')
      return { model: explicit ?? process.env['OPENROUTER_MODEL'] ?? 'openai/gpt-4o-mini' }
    }
    if (model === 'openai') return { model: await this.resolveOpenAiModel(storeId) }
    if (model === 'claude') return { claude: await this.resolveClaudeOptions(storeId) }
    if (model === 'manus') {
      const explicit = await this.resolveExplicitModel(storeId, 'manus')
      return { model: explicit ?? process.env['MANUS_AGENT_PROFILE'] ?? 'manus-1.6-lite' }
    }
    if (model === 'gemini') {
      const explicit = await this.resolveExplicitModel(storeId, model)
      const fallback = process.env['GEMINI_MODEL']?.trim() || 'gemini-2.0-flash'
      return { model: explicit ?? fallback }
    }
    if (model === 'grok') {
      const explicit = await this.resolveExplicitModel(storeId, model)
      if (explicit) return { model: explicit }
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

  private async resolveClaudeKey(storeId: string, rowKey: string | null): Promise<ResolvedKey> {
    const opts = await this.resolveClaudeOptions(storeId)
    if (opts.authMode === 'antigravity_proxy' && opts.baseUrl) {
      const token = opts.authToken?.trim()
      return token ? { key: token, source: 'db' } : { key: null, source: null }
    }
    const fromIntegration = usableAiSecret(await this.integrations.getPlain(storeId, 'claude', 'apiKey'))
    if (fromIntegration) return { key: fromIntegration, source: 'db' }
    const decrypted = this.decryptKey(rowKey)
    if (decrypted) return { key: decrypted, source: 'db' }
    const fromEnv = this.envKey('claude')
    return fromEnv ? { key: fromEnv, source: 'env' } : { key: null, source: null }
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
      auto: { configured: Object.values(cfg.keys).some(Boolean) },
      openrouter: { configured: Boolean(cfg.keys.openrouter) },
      openai: { configured: Boolean(cfg.keys.openai) },
      claude: { configured: Boolean(cfg.keys.claude) },
      gemini: { configured: Boolean(cfg.keys.gemini) },
      grok: { configured: Boolean(cfg.keys.grok) },
      manus: { configured: Boolean(cfg.keys.manus) },
    }
    const isReady =
      cfg.activeModel === 'auto'
        ? Object.values(cfg.keys).some(Boolean)
        : Boolean(cfg.keys[cfg.activeModel as ConcreteModelId]) || Object.values(cfg.keys).some(Boolean)

    // `activeModelReady` only says a chat will get *an* answer. It stayed true
    // with the selected provider unconfigured, so the UI reported "ready" for a
    // model that could not answer and quietly handed the turn to another one.
    const activeModelHasKey =
      cfg.activeModel === 'auto'
        ? Object.values(cfg.keys).some(Boolean)
        : Boolean(cfg.keys[cfg.activeModel as ConcreteModelId])

    return {
      activeModel: cfg.activeModel,
      models,
      activeModelReady: isReady,
      activeModelHasKey,
      fallbackModel: activeModelHasKey ? null : this.pickFallback(cfg),
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

    const storeId = await resolveStoreId(this.prisma, storeIdRaw)
    if (await this.resolveExplicitModel(storeId, base.model as ConcreteModelId)) return base

    const options: ModelProviderOptions = { ...(base.providerOptions ?? {}), model: cheap }

    return { ...base, providerOptions: options }
  }

  private envKey(model: ConcreteModelId): string | null {
    const raw =
      model === 'openrouter'
        ? this.config.get<string>('OPENROUTER_API_KEY')
        : model === 'openai'
          ? this.config.get<string>('OPENAI_API_KEY')
          : model === 'claude'
            ? this.config.get<string>('ANTHROPIC_API_KEY')
            : model === 'gemini'
              ? this.config.get<string>('GEMINI_API_KEY')
              : model === 'grok'
                ? this.config.get<string>('GROK_API_KEY')
                : model === 'manus'
                  ? this.config.get<string>('MANUS_API_KEY')
                  : null
    return usableAiSecret(raw)
  }

  private async resolveOpenAiModel(storeId: string): Promise<string> {
    return (await this.resolveExplicitModel(storeId, 'openai')) ?? DEFAULT_OPENAI_MODEL
  }

  private async resolveExplicitModel(storeId: string, model: ConcreteModelId): Promise<string | null> {
    const map = await this.integrations.getProviderMap(storeId, model)
    const fromDb = map.model ?? map.defaultModel
    if (fromDb) return String(fromDb)
    const envVar =
      model === 'openrouter'
        ? 'OPENROUTER_MODEL'
        : model === 'openai'
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
    return usableAiSecret(this.crypto.tryDecrypt(stored))
  }

  private async resolveKey(
    storeId: string,
    model: ConcreteModelId,
    rowKey: string | null,
  ): Promise<ResolvedKey> {
    const fromIntegration = usableAiSecret(await this.integrations.getPlain(storeId, model, 'apiKey'))
    if (fromIntegration) return { key: fromIntegration, source: 'db' }
    const decrypted = this.decryptKey(rowKey)
    if (decrypted) return { key: decrypted, source: 'db' }
    const fromEnv = this.envKey(model)
    return fromEnv ? { key: fromEnv, source: 'env' } : { key: null, source: null }
  }

  private async loadConfig(storeId: string): Promise<CachedConfig> {
    const now = Date.now()
    if (this.cache && this.cache.storeId === storeId && now - this.cache.at < CONFIG_CACHE_MS) {
      return this.cache
    }

    const row = await ensureAgentConfigRow(this.prisma, storeId)

    const resolved: Record<ConcreteModelId, ResolvedKey> = {
      openrouter: await this.resolveKey(storeId, 'openrouter', (row as unknown as { openrouterKey?: string }).openrouterKey ?? null),
      openai: await this.resolveKey(storeId, 'openai', row.openaiKey),
      claude: await this.resolveClaudeKey(storeId, row.claudeKey),
      gemini: await this.resolveKey(storeId, 'gemini', row.geminiKey),
      grok: await this.resolveKey(storeId, 'grok', row.grokKey),
      manus: await this.resolveKey(storeId, 'manus', row.manusKey),
    }

    const keys = {} as Record<ConcreteModelId, string | null>
    const sources = {} as Record<ConcreteModelId, KeySource | null>
    for (const id of Object.keys(resolved) as ConcreteModelId[]) {
      keys[id] = resolved[id].key
      sources[id] = resolved[id].source
    }

    const activeModel = (row.activeModel as AgentModelId) || 'auto'

    this.cache = { at: now, storeId, activeModel, keys, sources }
    return this.cache
  }
}

