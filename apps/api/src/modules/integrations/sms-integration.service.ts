import { BadRequestException, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../../common/prisma.service'
import { EncryptionService } from './encryption.service'
import { IntegrationsService } from './integrations.service'

export type SmsGateway = 'bdbulksms' | 'elitbuzz' | 'greenweb' | 'custom'

export interface SmsRuntimeCredentials {
  gateway: SmsGateway
  apiUrl: string
  apiKey: string
  senderId: string
  username: string
  password: string
  method: 'GET' | 'POST'
  enabled: boolean
  configured: boolean
  source: 'database' | 'env' | 'none'
}

const PROVIDER = 'sms'

const SECRET_KEYS = new Set(['apiKey', 'password'])

const DEFAULT_URL: Record<SmsGateway, string> = {
  bdbulksms: 'https://bulksmsbd.net/api/smsapi',
  elitbuzz: 'https://msg.elitbuzz-bd.com/smsapi',
  greenweb: 'https://api.greenweb.com.bd/api.php',
  custom: '',
}

const PLACEHOLDERS = new Set([
  '',
  'your-sms-api-key',
  'your-sms-api-secret',
  '••••••••',
])

function isPlaceholder(value: string | undefined | null): boolean {
  const v = (value ?? '').trim()
  if (!v) return true
  if (PLACEHOLDERS.has(v)) return true
  if (v.includes('••••')) return true
  if (v.startsWith('your-')) return true
  return false
}

function asGateway(raw: string | undefined | null): SmsGateway {
  const v = (raw ?? '').trim().toLowerCase()
  if (v === 'elitbuzz' || v === 'greenweb' || v === 'custom' || v === 'bdbulksms') return v
  return 'bdbulksms'
}

function asMethod(raw: string | undefined | null, gateway: SmsGateway): 'GET' | 'POST' {
  const v = (raw ?? '').trim().toUpperCase()
  if (v === 'POST' || v === 'GET') return v
  return gateway === 'elitbuzz' ? 'POST' : 'GET'
}

@Injectable()
export class SmsIntegrationService {
  constructor(
    private readonly integrations: IntegrationsService,
    private readonly crypto: EncryptionService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  defaultUrl(gateway: SmsGateway): string {
    return DEFAULT_URL[gateway]
  }

  private envFallback(): Record<string, string> {
    const envGateway = (this.config.get<string>('SMS_PROVIDER') ?? '').trim().toLowerCase()
    const gateway =
      envGateway === 'elitbuzz' || envGateway === 'greenweb' || envGateway === 'custom'
        ? envGateway
        : this.config.get<string>('BDBULKSMS_API_KEY')
          ? 'bdbulksms'
          : this.config.get<string>('ELITBUZZ_API_TOKEN')
            ? 'elitbuzz'
            : this.config.get<string>('GREENWEB_SMS_USER')
              ? 'greenweb'
              : 'bdbulksms'

    return {
      gateway,
      apiUrl:
        this.config.get<string>('SMS_API_URL') ??
        this.config.get<string>('BDBULKSMS_API_URL') ??
        DEFAULT_URL[asGateway(gateway)],
      apiKey:
        this.config.get<string>('BDBULKSMS_API_KEY') ??
        this.config.get<string>('ELITBUZZ_API_TOKEN') ??
        this.config.get<string>('SMS_API_KEY') ??
        '',
      senderId:
        this.config.get<string>('BDBULKSMS_SENDER_ID') ??
        this.config.get<string>('ELITBUZZ_SENDER_ID') ??
        this.config.get<string>('SMS_SENDER_ID') ??
        'SPLARO',
      username: this.config.get<string>('GREENWEB_SMS_USER') ?? '',
      password: this.config.get<string>('GREENWEB_SMS_PASS') ?? '',
      method: gateway === 'elitbuzz' ? 'POST' : 'GET',
      enabled: 'true',
    }
  }

  isConfigured(fields: Record<string, string>, gateway: SmsGateway = asGateway(fields.gateway)): boolean {
    if (isPlaceholder(fields.apiUrl) && gateway === 'custom') return false
    if (gateway === 'greenweb') {
      return !isPlaceholder(fields.username) && !isPlaceholder(fields.password)
    }
    return !isPlaceholder(fields.apiKey) && (gateway !== 'custom' || !isPlaceholder(fields.apiUrl))
  }

  async resolveRuntime(storeIdRaw?: string): Promise<SmsRuntimeCredentials> {
    const storeId = storeIdRaw ? await this.integrations.resolveStore(storeIdRaw) : null
    const fallback = this.envFallback()
    const merged: Record<string, string> = { ...fallback }
    let source: SmsRuntimeCredentials['source'] = this.isConfigured(fallback, asGateway(fallback.gateway))
      ? 'env'
      : 'none'

    if (storeId) {
      const adminManaged = await this.integrations.hasProviderSettings(storeId, PROVIDER)
      if (adminManaged) {
        const map = await this.integrations.getProviderMap(storeId, PROVIDER)
        for (const key of Object.keys(fallback)) {
          const val = map[key]
          if (typeof val === 'string' && val.trim() && !isPlaceholder(val)) merged[key] = val.trim()
          if (typeof val === 'boolean') merged[key] = val ? 'true' : 'false'
        }
        source = 'database'
      }

      const settings = await this.prisma.siteSettings.findUnique({
        where: { storeId },
        select: { smsEnabled: true },
      })
      if (settings && merged.enabled === 'true') {
        merged.enabled = settings.smsEnabled ? 'true' : 'false'
      }
    }

    const gateway = asGateway(merged.gateway)
    const apiUrl = (merged.apiUrl || DEFAULT_URL[gateway]).trim()
    return {
      gateway,
      apiUrl,
      apiKey: merged.apiKey?.trim() ?? '',
      senderId: (merged.senderId || 'SPLARO').trim(),
      username: merged.username?.trim() ?? '',
      password: merged.password?.trim() ?? '',
      method: asMethod(merged.method, gateway),
      enabled: merged.enabled !== 'false',
      configured: this.isConfigured({ ...merged, apiUrl, gateway }, gateway),
      source,
    }
  }

  async getConfig(storeIdRaw: string) {
    const storeId = await this.integrations.resolveStore(storeIdRaw)
    const runtime = await this.resolveRuntime(storeId)
    const fallback = this.envFallback()
    const adminManaged = await this.integrations.hasProviderSettings(storeId, PROVIDER)
    const settings = await this.prisma.siteSettings.findUnique({
      where: { storeId },
      select: { smsEnabled: true },
    })
    const meta = await this.integrations.getProviderMeta(storeId, PROVIDER)

    const fields: Record<string, string> = {
      gateway: runtime.gateway,
      apiUrl: runtime.apiUrl || this.defaultUrl(runtime.gateway),
      apiKey: runtime.configured && !isPlaceholder(runtime.apiKey) ? '••••••••' : '',
      senderId: runtime.senderId || 'SPLARO',
      username: runtime.username,
      password: runtime.configured && !isPlaceholder(runtime.password) ? '••••••••' : '',
      method: runtime.method,
      enabled: (settings?.smsEnabled ?? runtime.enabled) ? 'true' : 'false',
    }

    const fieldSources: Record<string, 'database' | 'env' | 'none'> = {}
    for (const key of Object.keys(fallback)) {
      const fromDb = await this.integrations.getPlain(storeId, PROVIDER, key)
      if (fromDb && !isPlaceholder(fromDb)) {
        fieldSources[key] = 'database'
        continue
      }
      fieldSources[key] = isPlaceholder(fallback[key]) ? 'none' : 'env'
    }

    return {
      provider: PROVIDER,
      configured: runtime.configured,
      source: runtime.source,
      adminManaged,
      enabled: settings?.smsEnabled ?? runtime.enabled,
      fields,
      fieldSources,
      lastTestedAt: meta.lastTestedAt,
      lastTestStatus: meta.lastTestStatus,
      lastTestMessage: meta.lastTestMessage,
    }
  }

  async update(storeIdRaw: string, body: Record<string, string | boolean | undefined>, userId?: string) {
    const storeId = await this.integrations.resolveStore(storeIdRaw)
    const saved: string[] = []
    const cleared: string[] = []
    const skipped: { key: string; reason: string }[] = []

    const allowed = new Set(['gateway', 'apiUrl', 'apiKey', 'senderId', 'username', 'password', 'method', 'enabled'])

    for (const [key, raw] of Object.entries(body)) {
      if (!allowed.has(key) || raw === undefined) continue
      if (typeof raw === 'boolean') {
        await this.integrations.upsertPlain({
          storeId,
          provider: PROVIDER,
          key,
          value: raw,
          userId,
        })
        if (key === 'enabled') {
          await this.prisma.siteSettings.updateMany({
            where: { storeId },
            data: { smsEnabled: raw },
          })
        }
        saved.push(key)
        continue
      }

      const value = String(raw).trim()
      if (!value) {
        const removed = await this.integrations.deleteSetting(storeId, PROVIDER, key)
        if (removed) cleared.push(key)
        continue
      }
      if (this.crypto.isMaskedInput(value)) {
        skipped.push({ key, reason: 'unchanged (masked value resubmitted)' })
        continue
      }
      if (isPlaceholder(value) && SECRET_KEYS.has(key)) {
        skipped.push({ key, reason: `looks like a placeholder, not a real credential` })
        continue
      }

      if (key === 'gateway') {
        const gateway = asGateway(value)
        await this.integrations.upsertPlain({ storeId, provider: PROVIDER, key, value: gateway, userId })
        saved.push(key)
        continue
      }
      if (key === 'method') {
        await this.integrations.upsertPlain({
          storeId,
          provider: PROVIDER,
          key,
          value: asMethod(value, 'custom'),
          userId,
        })
        saved.push(key)
        continue
      }
      if (key === 'apiUrl') {
        let url = value
        try {
          const parsed = new URL(url)
          if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
            throw new BadRequestException('API URL must start with https://')
          }
          url = parsed.toString().replace(/\/$/, '')
        } catch (err) {
          if (err instanceof BadRequestException) throw err
          throw new BadRequestException('Enter a valid API URL / link')
        }
        await this.integrations.upsertPlain({ storeId, provider: PROVIDER, key, value: url, userId })
        saved.push(key)
        continue
      }
      if (key === 'enabled') {
        const on = value === 'true' || value === '1' || value.toLowerCase() === 'on'
        await this.integrations.upsertPlain({
          storeId,
          provider: PROVIDER,
          key,
          value: on,
          userId,
        })
        await this.prisma.siteSettings.updateMany({
          where: { storeId },
          data: { smsEnabled: on },
        })
        saved.push(key)
        continue
      }

      if (SECRET_KEYS.has(key)) {
        await this.integrations.upsertSecret({ storeId, provider: PROVIDER, key, plain: value, userId })
      } else {
        await this.integrations.upsertPlain({ storeId, provider: PROVIDER, key, value, userId })
      }
      saved.push(key)
    }

    const config = await this.getConfig(storeIdRaw)
    return { ...config, saved, cleared, skipped }
  }

  async test(storeIdRaw: string, userId?: string) {
    const storeId = await this.integrations.resolveStore(storeIdRaw)
    const runtime = await this.resolveRuntime(storeId)
    if (!runtime.configured) {
      throw new BadRequestException('Save API key / link first — nothing to test')
    }
    if (!runtime.enabled) {
      throw new BadRequestException('SMS is switched off — turn it on before testing')
    }

    let ok = false
    let message = ''

    try {
      if (runtime.gateway === 'bdbulksms') {
        const balanceUrl = runtime.apiUrl.includes('bulksmsbd.net')
          ? 'https://bulksmsbd.net/api/getBalanceApi'
          : null
        if (balanceUrl) {
          const res = await fetch(`${balanceUrl}?api_key=${encodeURIComponent(runtime.apiKey)}`, {
            signal: AbortSignal.timeout(12_000),
          })
          const text = (await res.text()).trim()
          const balance = Number(text)
          if (Number.isFinite(balance) && balance >= 0 && !text.startsWith('100')) {
            ok = true
            message = `BDBulkSMS reachable · balance ${balance}`
          } else if (text === '202' || /success|ok/i.test(text)) {
            ok = true
            message = `BDBulkSMS reachable · ${text.slice(0, 80)}`
          } else {
            message = `BDBulkSMS refused: ${text.slice(0, 160) || `HTTP ${res.status}`}`
          }
        } else {
          message = 'Custom BDBulkSMS URL saved. Send a test SMS below to prove it.'
          ok = true
        }
      } else if (runtime.gateway === 'elitbuzz') {
        const res = await fetch(runtime.apiUrl, {
          method: 'OPTIONS',
          signal: AbortSignal.timeout(10_000),
        }).catch(() => null)
        ok = Boolean(res)
        message = ok
          ? 'ElitBuzz host reachable. Send a test SMS below to prove the token.'
          : 'Could not reach ElitBuzz host. Check the API URL.'
      } else {
        try {
          const parsed = new URL(runtime.apiUrl)
          ok = parsed.protocol === 'https:' || parsed.protocol === 'http:'
          message = ok
            ? `URL saved (${parsed.host}). Send a test SMS below to prove the key works.`
            : 'API URL is not valid.'
        } catch {
          ok = false
          message = 'API URL is not valid.'
        }
      }
    } catch (err) {
      ok = false
      message = err instanceof Error ? err.message : 'SMS gateway test failed'
    }

    await this.integrations.recordTest({
      storeId,
      provider: PROVIDER,
      success: ok,
      message,
      userId,
    })

    return { ok, message, provider: runtime.gateway }
  }
}
