import { BadRequestException, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import axios from 'axios'
import { IntegrationsService } from './integrations.service'
import { EncryptionService } from './encryption.service'

export type InfraProvider = 'cloudflare_r2' | 'steadfast' | 'pathao' | 'redx'

const SECRET_KEYS = new Set(['accessKey', 'secretKey', 'apiKey', 'clientSecret', 'password'])

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

  private isConfigured(provider: InfraProvider, fields: Record<string, string>): boolean {
    const placeholders = new Set([
      '',
      'your-r2-access-key',
      'your-r2-secret-key',
      'local-dev-steadfast-key',
      'your-steadfast-api-key',
    ])

    if (provider === 'cloudflare_r2') {
      return Boolean(
        fields.accessKey &&
          fields.secretKey &&
          fields.bucket &&
          !placeholders.has(fields.accessKey) &&
          !placeholders.has(fields.secretKey),
      )
    }
    if (provider === 'pathao') {
      return Boolean(
        fields.clientId &&
          fields.clientSecret &&
          fields.username &&
          fields.password &&
          fields.storeId &&
          !placeholders.has(fields.clientSecret) &&
          !placeholders.has(fields.password),
      )
    }
    if (provider === 'redx') {
      return Boolean(fields.apiKey && !placeholders.has(fields.apiKey))
    }
    return Boolean(
      fields.apiKey &&
        fields.secretKey &&
        !placeholders.has(fields.apiKey) &&
        !placeholders.has(fields.secretKey),
    )
  }

  async getConfig(storeIdRaw: string, provider: InfraProvider) {
    const storeId = await this.integrations.resolveStore(storeIdRaw)
    const saved = await this.integrations.getProviderMap(storeId, provider)
    const fallback = this.envFallback(provider)
    const fields: Record<string, string> = { ...fallback }

    for (const [key, value] of Object.entries(saved)) {
      if (value === null || value === undefined) continue
      if (SECRET_KEYS.has(key)) {
        const has = await this.integrations.hasSecret(storeId, provider, key)
        fields[key] = has ? '••••••••' : ''
      } else {
        fields[key] = String(value)
      }
    }

    const configured = this.isConfigured(provider, fields)
    const source = Object.keys(saved).length ? 'database' : configured ? 'env' : 'none'

    return {
      provider,
      configured,
      source,
      fields,
      lastTestedAt: (await this.integrations.getProviderMeta(storeId, provider)).lastTestedAt,
      lastTestStatus: (await this.integrations.getProviderMeta(storeId, provider)).lastTestStatus,
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
      if (!value || this.crypto.isMaskedInput(value)) continue
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
      throw new BadRequestException(`${provider} credentials incomplete — save keys first`)
    }

    const creds = await this.resolveRuntimeCredentials(storeIdRaw, provider)

    try {
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
    const saved = await this.integrations.getProviderMap(storeId, provider)
    const fallback = this.envFallback(provider)
    const pick = async (key: string) => {
      const fromDb = saved[key]
      if (typeof fromDb === 'string' && fromDb) return fromDb
      const secret = await this.integrations.getPlain(storeId, provider, key)
      if (secret) return secret
      return fallback[key] ?? ''
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
