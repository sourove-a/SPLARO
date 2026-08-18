import { BadRequestException, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { resolveCustomerFacingApiBase } from '@splaro/config'
import axios from 'axios'
import { IntegrationsService } from './integrations.service'
import { EncryptionService } from './encryption.service'

export type InfraProvider = 'cloudflare_r2' | 'steadfast' | 'pathao' | 'redx'

/**
 * Steadfast's API is served from packzy.com, not steadfast.com.bd — the latter
 * has no `portal` host at all, so requests failed with `getaddrinfo ENOTFOUND
 * portal.steadfast.com.bd` before any credential was ever sent. The path is
 * `/api/v1`; `/public/api/v1` 404s.
 */
export const STEADFAST_BASE_URL = 'https://portal.packzy.com/api/v1'

/** Self-heal base URLs already saved to the DB or .env with the dead host/path. */
export function normalizeSteadfastBaseUrl(value: string | undefined | null): string {
  const raw = (value ?? '').trim().replace(/\/+$/, '')
  if (!raw) return STEADFAST_BASE_URL
  if (/portal\.steadfast\.com\.bd/i.test(raw)) return STEADFAST_BASE_URL
  if (/packzy\.com\/public\/api\/v1$/i.test(raw)) return STEADFAST_BASE_URL
  return raw
}

const SECRET_KEYS = new Set([
  'accessKey',
  'secretKey',
  'apiKey',
  'clientSecret',
  'password',
  'webhookBearerToken',
])

/** Documented placeholders / local stubs — never treat as real credentials in UI. */
const PLACEHOLDER_VALUES = new Set([
  '',
  'your-r2-access-key',
  'your-r2-secret-key',
  'local-dev-steadfast-key',
  'local-dev-steadfast-secret',
  'your-steadfast-api-key',
  'your-steadfast-secret-key',
  'your-pathao-client-id',
  'your-pathao-client-secret',
  'your-pathao-username',
  'your-pathao-password',
  'your-redx-api-key',
  '••••••••',
])

@Injectable()
export class InfrastructureIntegrationService {
  constructor(
    private readonly integrations: IntegrationsService,
    private readonly crypto: EncryptionService,
    private readonly config: ConfigService,
  ) {}

  private envFallback(provider: InfraProvider): Record<string, string> {
    if (provider === 'cloudflare_r2') {
      return {
        accessKey: this.config.get<string>('CLOUDFLARE_R2_ACCESS_KEY') ?? '',
        secretKey: this.config.get<string>('CLOUDFLARE_R2_SECRET_KEY') ?? '',
        bucket: this.config.get<string>('CLOUDFLARE_R2_BUCKET') ?? '',
        endpoint: this.config.get<string>('CLOUDFLARE_R2_ENDPOINT') ?? '',
        publicUrl: this.config.get<string>('CLOUDFLARE_R2_PUBLIC_URL') ?? '',
      }
    }
    if (provider === 'pathao') {
      return {
        clientId: this.config.get<string>('PATHAO_CLIENT_ID') ?? '',
        clientSecret: this.config.get<string>('PATHAO_CLIENT_SECRET') ?? '',
        username: this.config.get<string>('PATHAO_USERNAME') ?? '',
        password: this.config.get<string>('PATHAO_PASSWORD') ?? '',
        storeId: this.config.get<string>('PATHAO_STORE_ID') ?? '',
      }
    }
    if (provider === 'redx') {
      return {
        apiKey: this.config.get<string>('REDX_API_KEY') ?? '',
      }
    }
    return {
      apiKey: this.config.get<string>('STEADFAST_API_KEY') ?? '',
      secretKey: this.config.get<string>('STEADFAST_SECRET_KEY') ?? '',
      baseUrl: normalizeSteadfastBaseUrl(this.config.get<string>('STEADFAST_BASE_URL')),
      webhookBearerToken: this.config.get<string>('STEADFAST_WEBHOOK_BEARER_TOKEN') ?? '',
    }
  }

  private isPlaceholder(value: string | undefined): boolean {
    const v = (value ?? '').trim()
    if (!v) return true
    if (PLACEHOLDER_VALUES.has(v)) return true
    if (v.includes('••••')) return true
    if (v.startsWith('your-') || v.startsWith('local-dev-')) return true
    return false
  }

  private isConfigured(provider: InfraProvider, fields: Record<string, string>): boolean {
    if (provider === 'cloudflare_r2') {
      return Boolean(
        !this.isPlaceholder(fields.accessKey) &&
          !this.isPlaceholder(fields.secretKey) &&
          fields.bucket?.trim(),
      )
    }
    if (provider === 'pathao') {
      return Boolean(
        !this.isPlaceholder(fields.clientId) &&
          !this.isPlaceholder(fields.clientSecret) &&
          !this.isPlaceholder(fields.username) &&
          !this.isPlaceholder(fields.password) &&
          fields.storeId?.trim(),
      )
    }
    if (provider === 'redx') {
      return !this.isPlaceholder(fields.apiKey)
    }
    return !this.isPlaceholder(fields.apiKey) && !this.isPlaceholder(fields.secretKey)
  }

  /** Form fields for admin UI — never dump placeholder env stubs into password inputs. */
  private fieldsForAdminUi(
    provider: InfraProvider,
    runtime: Record<string, string>,
  ): Record<string, string> {
    const fallback = this.envFallback(provider)
    const configured = this.isConfigured(provider, runtime)
    const out: Record<string, string> = {}

    for (const key of Object.keys(fallback)) {
      const raw = runtime[key] ?? fallback[key] ?? ''
      if (SECRET_KEYS.has(key)) {
        out[key] = configured && !this.isPlaceholder(raw) ? '••••••••' : ''
        continue
      }
      if (key === 'baseUrl') {
        out[key] = normalizeSteadfastBaseUrl(
          (raw.trim() && !this.isPlaceholder(raw) ? raw.trim() : '') || fallback.baseUrl,
        )
        continue
      }
      out[key] = this.isPlaceholder(raw) ? '' : raw
    }

    void provider
    return out
  }

  /**
   * Per-field provenance. The form prefills from the environment when nothing is
   * saved, which made env stubs look like credentials the operator had entered —
   * and saving then wrote those stubs into the database. The UI needs to be able
   * to say "this came from .env, it is not saved" per field.
   */
  private async fieldSources(
    storeId: string,
    provider: InfraProvider,
  ): Promise<Record<string, 'database' | 'env' | 'none'>> {
    const fallback = this.envFallback(provider)
    const out: Record<string, 'database' | 'env' | 'none'> = {}

    for (const key of Object.keys(fallback)) {
      const fromDb = await this.integrations.getPlain(storeId, provider, key)
      if (fromDb && !this.isPlaceholder(fromDb)) {
        out[key] = 'database'
        continue
      }
      out[key] = this.isPlaceholder(fallback[key]) ? 'none' : 'env'
    }

    return out
  }

  async getConfig(storeIdRaw: string, provider: InfraProvider) {
    const storeId = await this.integrations.resolveStore(storeIdRaw)
    const adminManaged = await this.integrations.hasProviderSettings(storeId, provider)
    const runtime = (await this.resolveRuntimeCredentials(storeIdRaw, provider)) as unknown as Record<
      string,
      string
    >
    const configured = this.isConfigured(provider, runtime)
    const source = adminManaged ? 'database' : configured ? 'env' : 'none'
    const fields = this.fieldsForAdminUi(provider, runtime)
    const fieldSources = await this.fieldSources(storeId, provider)
    const meta = await this.integrations.getProviderMeta(storeId, provider)

    const webhookBearer =
      provider === 'steadfast' ? (runtime.webhookBearerToken ?? '').trim() : ''
    const webhookConfigured =
      provider === 'steadfast' && Boolean(webhookBearer) && !this.isPlaceholder(webhookBearer)

    return {
      provider,
      configured,
      source,
      adminManaged,
      fields,
      fieldSources,
      lastTestedAt: meta.lastTestedAt,
      lastTestStatus: meta.lastTestStatus,
      ...(provider === 'steadfast'
        ? {
            callbackUrl: this.buildSteadfastCallbackUrl(),
            callbackUrlLegacy: this.buildSteadfastCallbackLegacyUrl(),
            webhookConfigured,
          }
        : {}),
    }
  }

  /**
   * Public Callback Url for Steadfast portal Webhook Integration.
   * Always customer-facing (https://splaro.co/api/v1/…) — never localhost / INTERNAL_API_URL.
   * Steadfast’s servers cannot POST to loopback even when admin runs in local dev.
   */
  buildSteadfastCallbackUrl(): string {
    const base = resolveCustomerFacingApiBase().replace(/\/+$/, '')
    return `${base}/webhooks/steadfast`
  }

  /** Same handler as {@link buildSteadfastCallbackUrl} — for older portal configs. */
  buildSteadfastCallbackLegacyUrl(): string {
    const base = resolveCustomerFacingApiBase().replace(/\/+$/, '')
    return `${base}/courier/steadfast-webhook`
  }

  async resolveWebhookBearerToken(storeIdRaw?: string): Promise<string | null> {
    try {
      const storeId = await this.integrations.resolveStore(storeIdRaw ?? '')
      const runtime = (await this.resolveRuntimeCredentials(storeId, 'steadfast')) as {
        webhookBearerToken?: string
      }
      const token = (runtime.webhookBearerToken ?? '').trim()
      if (!token || this.isPlaceholder(token)) return null
      return token
    } catch {
      // Isolated e2e DB / partial Prisma mocks — treat as unconfigured, not 500.
      return null
    }
  }

  /**
   * Reports what it actually persisted. Previously every ignored field was
   * skipped in silence, so a save that stored nothing still looked successful
   * and the form then re-rendered the old value — the "save hoy, kintu onno ta
   * dekhay" behaviour. Callers can now show exactly what landed and what did not.
   */
  async update(
    storeIdRaw: string,
    provider: InfraProvider,
    body: Record<string, string | undefined>,
    userId?: string,
  ) {
    const storeId = await this.integrations.resolveStore(storeIdRaw)
    const saved: string[] = []
    const cleared: string[] = []
    const skipped: { key: string; reason: string }[] = []

    for (const [key, raw] of Object.entries(body)) {
      if (raw === undefined) continue
      const value = String(raw).trim()

      // An explicitly empty field means "remove this credential". It used to be
      // indistinguishable from "not submitted", so clearing a key was impossible.
      if (!value) {
        const removed = await this.integrations.deleteSetting(storeId, provider, key)
        if (removed) cleared.push(key)
        continue
      }

      if (this.crypto.isMaskedInput(value)) {
        skipped.push({ key, reason: 'unchanged (masked value resubmitted)' })
        continue
      }
      if (this.isPlaceholder(value)) {
        skipped.push({ key, reason: `looks like a placeholder, not a real credential: "${value}"` })
        continue
      }

      const normalized =
        provider === 'steadfast' && key === 'baseUrl' ? normalizeSteadfastBaseUrl(value) : value

      if (SECRET_KEYS.has(key)) {
        await this.integrations.upsertSecret({ storeId, provider, key, plain: normalized, userId })
      } else {
        await this.integrations.upsertPlain({ storeId, provider, key, value: normalized, userId })
      }
      saved.push(key)
    }

    const config = await this.getConfig(storeIdRaw, provider)
    return { ...config, saved, cleared, skipped }
  }

  async test(storeIdRaw: string, provider: InfraProvider, userId?: string) {
    const storeId = await this.integrations.resolveStore(storeIdRaw)
    const cfg = await this.getConfig(storeIdRaw, provider)
    if (!cfg.configured) {
      throw new BadRequestException(`${provider} credentials incomplete — save real keys first`)
    }

    const creds = await this.resolveRuntimeCredentials(storeIdRaw, provider)

    try {
      if (provider === 'steadfast') {
        const response = await axios.get(`${creds.baseUrl}/get_balance`, {
          headers: {
            'Api-Key': creds.apiKey,
            'Secret-Key': creds.secretKey,
            'Content-Type': 'application/json',
          },
          timeout: 15000,
        })
        const data = response.data as { status?: number; current_balance?: number; message?: string }
        if (data.status !== undefined && data.status !== 200) {
          throw new BadRequestException(data.message ?? 'Steadfast balance check failed')
        }
        const balance =
          typeof data.current_balance === 'number' ? data.current_balance : undefined
        await this.integrations.recordTest({
          storeId,
          provider,
          success: true,
          message:
            balance !== undefined
              ? `Steadfast OK · balance ${balance} BDT`
              : 'Steadfast credentials verified',
          userId,
        })
        return {
          ok: true,
          message:
            balance !== undefined
              ? `Steadfast connected · balance ${balance} BDT`
              : 'Steadfast connection OK',
        }
      }
      if (provider === 'pathao') {
        await axios.post(
          'https://courier.pathao.com/aladdin/api/v1/issue-token',
          {
            client_id: creds.clientId,
            client_secret: creds.clientSecret,
            username: creds.username,
            password: creds.password,
            grant_type: 'password',
          },
          { timeout: 15000 },
        )
      } else if (provider === 'redx') {
        await axios.get('https://openapi.redx.com.bd/v1.0.0-beta/areas', {
          headers: {
            'Content-Type': 'application/json',
            'API-ACCESS-TOKEN': `Bearer ${creds.apiKey}`,
          },
          timeout: 15000,
        })
      } else {
        throw new BadRequestException(`Connection test not supported for ${provider}`)
      }

      await this.integrations.recordTest({
        storeId,
        provider,
        success: true,
        message: `${provider} credentials verified`,
        userId,
      })
      return { ok: true, message: `${provider} connection OK` }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Connection failed'
      await this.integrations.recordTest({ storeId, provider, success: false, message, userId })
      throw new BadRequestException(message)
    }
  }

  async resolveRuntimeCredentials(storeIdRaw: string, provider: InfraProvider) {
    const storeId = await this.integrations.resolveStore(storeIdRaw)
    const adminManaged = await this.integrations.hasProviderSettings(storeId, provider)
    const saved = await this.integrations.getProviderMap(storeId, provider)
    const fallback = this.envFallback(provider)

    const pick = async (key: string) => {
      const fromSaved = saved[key]
      if (typeof fromSaved === 'string' && fromSaved && !this.isPlaceholder(fromSaved)) return fromSaved
      const fromDb = await this.integrations.getPlain(storeId, provider, key)
      if (fromDb && !this.isPlaceholder(fromDb)) return fromDb
      if (!adminManaged) {
        return fallback[key] ?? ''
      }
      return ''
    }

    if (provider === 'cloudflare_r2') {
      return {
        accessKey: await pick('accessKey'),
        secretKey: await pick('secretKey'),
        bucket: await pick('bucket'),
        endpoint: await pick('endpoint'),
        publicUrl: await pick('publicUrl'),
      }
    }

    if (provider === 'pathao') {
      return {
        clientId: await pick('clientId'),
        clientSecret: await pick('clientSecret'),
        username: await pick('username'),
        password: await pick('password'),
        storeId: await pick('storeId'),
      }
    }

    if (provider === 'redx') {
      return {
        apiKey: await pick('apiKey'),
      }
    }

    return {
      apiKey: await pick('apiKey'),
      secretKey: await pick('secretKey'),
      baseUrl: normalizeSteadfastBaseUrl((await pick('baseUrl')) || fallback.baseUrl),
      // Webhook Bearer: DB first; env STEADFAST_WEBHOOK_BEARER_TOKEN still OK when admin has API keys only
      webhookBearerToken:
        (await pick('webhookBearerToken')) || (fallback.webhookBearerToken ?? ''),
    }
  }
}
