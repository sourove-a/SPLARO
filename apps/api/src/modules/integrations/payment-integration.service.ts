import { BadRequestException, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import axios from 'axios'
import * as crypto from 'crypto'
import { EncryptionService } from './encryption.service'
import { IntegrationsService } from './integrations.service'

export type PaymentProvider = 'bkash' | 'nagad' | 'sslcommerz'

const SECRET_KEYS = new Set(['appSecret', 'password', 'privateKey', 'storePassword'])

@Injectable()
export class PaymentIntegrationService {
  constructor(
    private readonly integrations: IntegrationsService,
    private readonly crypto: EncryptionService,
    private readonly config: ConfigService,
  ) {}

  private envFallback(provider: PaymentProvider): Record<string, string | boolean> {
    if (provider === 'bkash') {
      return {
        appKey: this.config.get<string>('BKASH_APP_KEY') ?? '',
        appSecret: this.config.get<string>('BKASH_APP_SECRET') ?? '',
        username: this.config.get<string>('BKASH_USERNAME') ?? '',
        password: this.config.get<string>('BKASH_PASSWORD') ?? '',
        sandbox: this.config.get<string>('BKASH_SANDBOX') === 'true',
      }
    }
    if (provider === 'nagad') {
      return {
        merchantId: this.config.get<string>('NAGAD_MERCHANT_ID') ?? '',
        merchantNumber: this.config.get<string>('NAGAD_MERCHANT_NUMBER') ?? '',
        publicKey: this.config.get<string>('NAGAD_PUBLIC_KEY') ?? this.config.get<string>('NAGAD_MERCHANT_PUBLIC_KEY') ?? '',
        privateKey: this.config.get<string>('NAGAD_PRIVATE_KEY') ?? this.config.get<string>('NAGAD_MERCHANT_PRIVATE_KEY') ?? '',
        sandbox: this.config.get<string>('NAGAD_SANDBOX') === 'true',
      }
    }
    return {
      storeId: this.config.get<string>('SSLCOMMERZ_STORE_ID') ?? '',
      storePassword: this.config.get<string>('SSLCOMMERZ_STORE_PASSWORD') ?? '',
      sandbox: this.config.get<string>('SSLCOMMERZ_SANDBOX') === 'true',
    }
  }

  async getConfig(storeIdRaw: string, provider: PaymentProvider) {
    const storeId = await this.integrations.resolveStore(storeIdRaw)
    const saved = await this.integrations.getProviderMap(storeId, provider)
    const fallback = this.envFallback(provider)
    const merged: Record<string, string | boolean> = { ...fallback }

    for (const [key, value] of Object.entries(saved)) {
      if (value === null || value === undefined) continue
      if (typeof value === 'boolean') merged[key] = value
      else if (SECRET_KEYS.has(key)) {
        const has = await this.integrations.hasSecret(storeId, provider, key)
        merged[key] = has ? '••••••••' : ''
      } else {
        merged[key] = String(value)
      }
    }

    const source = Object.keys(saved).length ? 'database' : this.hasEnvCredentials(provider) ? 'env' : 'none'
    const configured = this.isConfigComplete(provider, merged)

    return {
      provider,
      configured,
      source,
      fields: merged,
      lastTestedAt: (await this.integrations.getProviderMeta(storeId, provider)).lastTestedAt,
      lastTestStatus: (await this.integrations.getProviderMeta(storeId, provider)).lastTestStatus,
    }
  }

  async getAll(storeIdRaw: string) {
    const providers: PaymentProvider[] = ['bkash', 'nagad', 'sslcommerz']
    return { items: await Promise.all(providers.map((p) => this.getConfig(storeIdRaw, p))) }
  }

  hasEnvCredentials(provider: PaymentProvider): boolean {
    const f = this.envFallback(provider)
    return this.isConfigComplete(provider, f)
  }

  isConfigComplete(provider: PaymentProvider, fields: Record<string, string | boolean>): boolean {
    if (provider === 'bkash') {
      return Boolean(fields.appKey && fields.appSecret && fields.username && fields.password)
    }
    if (provider === 'nagad') {
      return Boolean(fields.merchantId && fields.publicKey && fields.privateKey)
    }
    return Boolean(fields.storeId && fields.storePassword)
  }

  async isConfigured(storeIdRaw: string, provider: PaymentProvider): Promise<boolean> {
    const cfg = await this.getConfig(storeIdRaw, provider)
    return cfg.configured
  }

  async update(
    storeIdRaw: string,
    provider: PaymentProvider,
    body: Record<string, string | boolean | undefined>,
    userId?: string,
  ) {
    const storeId = await this.integrations.resolveStore(storeIdRaw)

    for (const [key, raw] of Object.entries(body)) {
      if (raw === undefined) continue
      if (typeof raw === 'boolean') {
        await this.integrations.upsertPlain({
          storeId,
          provider,
          key,
          value: raw,
          userId,
        })
        continue
      }
      const value = String(raw).trim()
      if (!value || this.crypto.isMaskedInput(value)) continue
      await this.integrations.upsertSecret({
        storeId,
        provider,
        key,
        plain: value,
        userId,
      })
    }

    return this.getConfig(storeIdRaw, provider)
  }

  async test(storeIdRaw: string, provider: PaymentProvider, userId?: string) {
    const storeId = await this.integrations.resolveStore(storeIdRaw)
    const cfg = await this.getConfig(storeIdRaw, provider)
    if (!cfg.configured) {
      throw new BadRequestException(`${provider} credentials incomplete — save keys first`)
    }

    const resolved = await this.resolveRuntimeCredentials(storeId, provider)

    try {
      if (provider === 'bkash') {
        const base = resolved.sandbox
          ? 'https://tokenized.sandbox.bka.sh/v1.2.0-beta'
          : 'https://tokenized.pay.bka.sh/v1.2.0-beta'
        await axios.post(
          `${base}/tokenized/checkout/token/grant`,
          { app_key: resolved.appKey, app_secret: resolved.appSecret },
          {
            headers: { username: resolved.username, password: resolved.password, 'Content-Type': 'application/json' },
            timeout: 15000,
          },
        )
      } else if (provider === 'sslcommerz') {
        const base = resolved.sandbox ? 'https://sandbox.sslcommerz.com' : 'https://securepay.sslcommerz.com'
        const params = new URLSearchParams({
          store_id: resolved.storeId!,
          store_passwd: resolved.storePassword!,
          total_amount: '10.00',
          currency: 'BDT',
          tran_id: `TEST-${Date.now()}`,
          success_url: 'https://splaro.co/payment/success',
          fail_url: 'https://splaro.co/payment/failed',
          cancel_url: 'https://splaro.co/payment/cancel',
          cus_name: 'SPLARO Test',
          cus_email: 'test@splaro.co',
          cus_phone: '01700000000',
          product_name: 'Test',
          product_category: 'Test',
          product_profile: 'general',
          shipping_method: 'NO',
        })
        await axios.post(`${base}/gwprocess/v4/api.php`, params, { timeout: 15000 })
      } else {
        const { merchantId, merchantNumber, publicKey, privateKey, sandbox } = resolved
        if (!merchantId || !publicKey || !privateKey) {
          throw new BadRequestException('Nagad credentials incomplete')
        }

        const encryptWithPublicKey = (pk: string, data: string) =>
          crypto
            .publicEncrypt(
              {
                key: `-----BEGIN PUBLIC KEY-----\n${pk}\n-----END PUBLIC KEY-----`,
                padding: crypto.constants.RSA_PKCS1_PADDING,
              },
              Buffer.from(data),
            )
            .toString('base64')

        const signWithPrivateKey = (pk: string, data: string) => {
          const sign = crypto.createSign('SHA256WithRSA')
          sign.update(data)
          return sign.sign(`-----BEGIN RSA PRIVATE KEY-----\n${pk}\n-----END RSA PRIVATE KEY-----`, 'base64')
        }

        const testOrderId = `SPLAROTEST${Date.now()}`
        const datetime = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)
        const sensitiveData = encryptWithPublicKey(
          publicKey,
          JSON.stringify({
            merchantId,
            datetime,
            orderId: testOrderId,
            challenge: crypto.randomBytes(16).toString('hex'),
          }),
        )
        const signature = signWithPrivateKey(privateKey, sensitiveData)
        const baseUrl = sandbox
          ? 'https://sandbox.mynagad.com:10080/remote-payment-gateway-1.0'
          : 'https://api.mynagad.com/api/dfs'

        await axios.post(
          `${baseUrl}/bill-payment/init/${merchantId}/${testOrderId}`,
          {
            accountNumber: merchantNumber || merchantId,
            datetime,
            sensitiveData,
            signature,
          },
          {
            headers: { 'X-KM-IP-V4': '127.0.0.1', 'X-KM-MC-Id': merchantId },
            timeout: 15000,
          },
        )
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

  async resolveRuntimeCredentials(storeId: string, provider: PaymentProvider) {
    const saved = await this.integrations.getProviderMap(storeId, provider)
    const fallback = this.envFallback(provider)
    const pick = async (key: string) => {
      const fromDb = saved[key]
      if (typeof fromDb === 'string' && fromDb) return fromDb
      const secret = await this.integrations.getPlain(storeId, provider, key)
      if (secret) return secret
      const fromEnv = fallback[key]
      return typeof fromEnv === 'string' ? fromEnv : ''
    }

    if (provider === 'bkash') {
      return {
        appKey: await pick('appKey'),
        appSecret: await pick('appSecret'),
        username: await pick('username'),
        password: await pick('password'),
        sandbox: saved.sandbox === true || saved.sandbox === 'true' || fallback.sandbox === true,
      }
    }
    if (provider === 'nagad') {
      return {
        merchantId: await pick('merchantId'),
        merchantNumber: await pick('merchantNumber'),
        publicKey: await pick('publicKey'),
        privateKey: await pick('privateKey'),
        sandbox: saved.sandbox === true || saved.sandbox === 'true' || fallback.sandbox === true,
      }
    }
    return {
      storeId: await pick('storeId'),
      storePassword: await pick('storePassword'),
      sandbox: saved.sandbox === true || saved.sandbox === 'true' || fallback.sandbox === true,
    }
  }
}
