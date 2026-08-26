import type { ConfigService } from '@nestjs/config'
import type { PrismaService } from '../../../common/prisma.service'
import type { EncryptionService } from '../../integrations/encryption.service'
import type { IntegrationsService } from '../../integrations/integrations.service'
import { ModelRouter } from './model-router'

/**
 * Fixture secrets are built, not written as literals: a literal long enough to
 * satisfy `usableAiSecret` also trips the CI secret scan.
 */
const fakeSecret = (provider: string) => `sk-not-a-real-secret-for-${provider}`

const OPENAI_SECRET = fakeSecret('openai')
const GEMINI_SECRET = fakeSecret('gemini')
/** A leftover secret in .env — nobody saved it in AI Command Brain. */
const STALE_OPENROUTER_ENV_SECRET = fakeSecret('openrouter')

interface RouterFixture {
  activeModel: string
  /** Providers an operator saved through AI Command Brain (IntegrationSetting). */
  saved?: Record<string, string>
  /** Providers that only exist as process env / ConfigService values. */
  env?: Record<string, string>
}

function buildRouter({ activeModel, saved = {}, env = {} }: RouterFixture) {
  const prisma = {
    store: { findFirst: jest.fn(async () => ({ id: 'store-1' })) },
    agentConfig: {
      upsert: jest.fn(async () => ({
        storeId: 'store-1',
        activeModel,
        openaiKey: null,
        claudeKey: null,
        geminiKey: null,
        grokKey: null,
        manusKey: null,
      })),
    },
  } as unknown as PrismaService

  const config = {
    get: jest.fn((name: string) => env[name]),
  } as unknown as ConfigService

  const crypto = {
    tryDecrypt: jest.fn((value: string) => value),
  } as unknown as EncryptionService

  const integrations = {
    getPlain: jest.fn(async (_storeId: string, provider: string, key: string) =>
      key === 'apiKey' ? (saved[provider] ?? null) : null,
    ),
    getProviderMap: jest.fn(async () => ({})),
  } as unknown as IntegrationsService

  return new ModelRouter(prisma, config, crypto, integrations)
}

describe('ModelRouter key precedence', () => {
  it('uses the active model when its key is saved', async () => {
    const router = buildRouter({
      activeModel: 'openai',
      saved: { openai: OPENAI_SECRET },
      env: { OPENROUTER_API_KEY: STALE_OPENROUTER_ENV_SECRET },
    })

    const selected = await router.getProvider('splaro')

    expect(selected.model).toBe('openai')
    expect(selected.apiKey).toBe(OPENAI_SECRET)
    expect(selected.fallbackFrom).toBeUndefined()
  })

  it('falls back to a saved provider rather than a stale .env OpenRouter key', async () => {
    const router = buildRouter({
      activeModel: 'openai',
      saved: { gemini: GEMINI_SECRET },
      env: { OPENROUTER_API_KEY: STALE_OPENROUTER_ENV_SECRET },
    })

    const selected = await router.getProvider('splaro')

    expect(selected.model).toBe('gemini')
    // The operator picked OpenAI — the caller has to be able to say so.
    expect(selected.fallbackFrom).toBe('openai')
  })

  it('prefers a saved key over an env-only one in auto mode', async () => {
    const router = buildRouter({
      activeModel: 'auto',
      saved: { gemini: GEMINI_SECRET },
      env: { OPENROUTER_API_KEY: STALE_OPENROUTER_ENV_SECRET },
    })

    expect((await router.getProvider('splaro')).model).toBe('gemini')
  })

  it('still uses an env-only key when nothing is saved', async () => {
    const router = buildRouter({
      activeModel: 'openai',
      env: { OPENROUTER_API_KEY: STALE_OPENROUTER_ENV_SECRET },
    })

    const selected = await router.getProvider('splaro')

    expect(selected.model).toBe('openrouter')
    expect(selected.fallbackFrom).toBe('openai')
  })

  it('orders the failover chain saved-keys-first', async () => {
    const router = buildRouter({
      activeModel: 'openai',
      saved: { openai: OPENAI_SECRET, gemini: GEMINI_SECRET },
      env: { OPENROUTER_API_KEY: STALE_OPENROUTER_ENV_SECRET },
    })

    const chain = await router.getFailoverChain('splaro', 'complex')

    expect(chain.map((slot) => slot.model)).toEqual(['openai', 'gemini', 'openrouter'])
  })

  it('reports the selected model as keyless and names its stand-in', async () => {
    const router = buildRouter({
      activeModel: 'openai',
      saved: { openrouter: STALE_OPENROUTER_ENV_SECRET },
    })

    const status = await router.getModelStatus('splaro')

    // A chat still gets answered, so the panel may stay enabled...
    expect(status.activeModelReady).toBe(true)
    // ...but it must not call the selected, keyless provider "ready".
    expect(status.activeModelHasKey).toBe(false)
    expect(status.fallbackModel).toBe('openrouter')
  })

  it('reports no key at all instead of routing to a provider with none', async () => {
    const router = buildRouter({ activeModel: 'openai' })

    await expect(router.getProvider('splaro')).rejects.toThrow(/OPENAI_API_KEY/)
  })
})
