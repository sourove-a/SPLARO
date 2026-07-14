import { BadRequestException, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import axios from 'axios'
import { IntegrationsService } from './integrations.service'
import { EncryptionService } from './encryption.service'

export type InfraProvider = 'cloudflare_r2' | 'steadfast' | 'pathao' | 'redx'

const SECRET_KEYS = new Set(['accessKey', 'secretKey', 'apiKey', 'clientSecret', 'password'])

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
      baseUrl:
        this.config.get<string>('STEADFAST_BASE_URL') ??
        'https://portal.steadfast.com.bd/public/api/v1',
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
        out[key] =
          (raw.trim() && !this.isPlaceholder(raw) ? raw.trim() : '') ||
          fallback.baseUrl ||
          'https://portal.steadfast.com.bd/public/api/v1'
        continue
      }
      out[key] = this.isPlaceholder(raw) ? '' : raw
    }

    void provider
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
    const meta = await this.integrations.getProviderMeta(storeId, provider)

    return {
      provider,
      configured,
      source,
      adminManaged,
      fields,
      lastTestedAt: meta.lastTestedAt,
      lastTestStatus: meta.lastTestStatus,
    }
  }

  async update(
    storeIdRaw: string,
    provider: InfraProvider,
    body: Record<string, string | undefined>,
    userId?: string,
  ) {
    const storeId = await this.integrations.resolveStore(storeIdRaw)

    for (const [key, raw] of Object.entries(body)) {
      if (raw === undefined) continue
      const value = String(raw).trim()
      if (!value || this.crypto.isMaskedInput(value) || this.isPlaceholder(value)) continue
      if (SECRET_KEYS.has(key)) {
        await this.integrations.upsertSecret({ storeId, provider, key, plain: value, userId })
      } else {
        await this.integrations.upsertPlain({ storeId, provider, key, value, userId })
      }
    }

    return this.getConfig(storeIdRaw, provider)
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
      baseUrl:
        (await pick('baseUrl')) ||
        fallback.baseUrl ||
        'https://portal.steadfast.com.bd/public/api/v1',
    }
  }
}
