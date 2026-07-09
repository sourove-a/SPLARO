import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'
import { resolveStoreId } from '../../common/store.util'
import { EncryptionService } from './encryption.service'

export type IntegrationProvider =
  | 'telegram'
  | 'openai'
  | 'google_sheets'
  | 'gmail'
  | 'google_drive'
  | 'sslcommerz'
  | 'bkash'
  | 'nagad'
  | 'steadfast'
  | 'pathao'
  | 'redx'
  | 'cloudflare_r2'
  | 'smtp'
  | 'sms'
  | 'meta_pixel'
  | 'google_analytics'
  | 'search_console'

@Injectable()
export class IntegrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: EncryptionService,
  ) {}

  async resolveStore(storeIdRaw: string) {
    return resolveStoreId(this.prisma, storeIdRaw)
  }

  async upsertPlain(params: {
    storeId: string
    provider: string
    key: string
    value: string | boolean | number | null
    userId?: string
    secret?: boolean
  }) {
    const str =
      params.value === null || params.value === undefined
        ? null
        : typeof params.value === 'string'
          ? params.value
          : String(params.value)

    if (params.secret && str) {
      return this.upsertSecret({
        storeId: params.storeId,
        provider: params.provider,
        key: params.key,
        plain: str,
        userId: params.userId,
      })
    }

    return this.prisma.integrationSetting.upsert({
      where: {
        storeId_provider_key: {
          storeId: params.storeId,
          provider: params.provider,
          key: params.key,
        },
      },
      create: {
        storeId: params.storeId,
        provider: params.provider,
        key: params.key,
        value: str,
        createdBy: params.userId,
        updatedBy: params.userId,
      },
      update: {
        value: str,
        updatedBy: params.userId,
      },
    })
  }

  async upsertSecret(params: {
    storeId: string
    provider: string
    key: string
    plain: string
    userId?: string
  }) {
    const encryptedValue = this.crypto.encrypt(params.plain)
    return this.prisma.integrationSetting.upsert({
      where: {
        storeId_provider_key: {
          storeId: params.storeId,
          provider: params.provider,
          key: params.key,
        },
      },
      create: {
        storeId: params.storeId,
        provider: params.provider,
        key: params.key,
        encryptedValue,
        createdBy: params.userId,
        updatedBy: params.userId,
      },
      update: {
        encryptedValue,
        updatedBy: params.userId,
      },
    })
  }

  async getPlain(storeId: string, provider: string, key: string): Promise<string | null> {
    const row = await this.prisma.integrationSetting.findUnique({
      where: { storeId_provider_key: { storeId, provider, key } },
    })
    if (!row) return null
    if (row.encryptedValue) return this.crypto.decrypt(row.encryptedValue)
    return row.value
  }

  async hasSecret(storeId: string, provider: string, key: string): Promise<boolean> {
    const row = await this.prisma.integrationSetting.findUnique({
      where: { storeId_provider_key: { storeId, provider, key } },
      select: { encryptedValue: true, value: true },
    })
    return Boolean(row?.encryptedValue || row?.value)
  }

  /** True once any key for this provider was saved via admin (encrypted DB). */
  async hasProviderSettings(storeId: string, provider: string): Promise<boolean> {
    const count = await this.prisma.integrationSetting.count({
      where: { storeId, provider },
    })
    return count > 0
  }

  async getProviderMap(storeId: string, provider: string) {
    const rows = await this.prisma.integrationSetting.findMany({
      where: { storeId, provider },
    })
    const out: Record<string, string | boolean | null> = {}
    for (const row of rows) {
      if (row.encryptedValue) {
        out[row.key] = this.crypto.decrypt(row.encryptedValue)
      } else if (row.value === 'true' || row.value === 'false') {
        out[row.key] = row.value === 'true'
      } else {
        out[row.key] = row.value
      }
    }
    return out
  }

  async getProviderMeta(storeId: string, provider: string) {
    const rows = await this.prisma.integrationSetting.findMany({
      where: { storeId, provider },
      orderBy: { updatedAt: 'desc' },
    })
    const latest = rows.find((r) => r.lastTestedAt) ?? rows[0]
    return {
      isEnabled: rows.some((r) => r.isEnabled) || rows.length === 0,
      lastTestedAt: latest?.lastTestedAt?.toISOString() ?? null,
      lastTestStatus: latest?.lastTestStatus ?? null,
      lastTestMessage: latest?.lastTestMessage ?? null,
    }
  }

  async recordTest(params: {
    storeId: string
    provider: string
    success: boolean
    message: string
    userId?: string
  }) {
    const status = params.success ? 'success' : 'failed'
    await this.prisma.integrationTestLog.create({
      data: {
        storeId: params.storeId,
        provider: params.provider,
        status,
        message: params.message,
        testedBy: params.userId,
      },
    })

    const existing = await this.prisma.integrationSetting.findFirst({
      where: { storeId: params.storeId, provider: params.provider },
    })
    if (existing) {
      await this.prisma.integrationSetting.updateMany({
        where: { storeId: params.storeId, provider: params.provider },
        data: {
          lastTestedAt: new Date(),
          lastTestStatus: status,
          lastTestMessage: params.message,
        },
      })
    }
  }

  maskIfSecret(key: string, value: string | null): string | null {
    if (!value) return null
    if (key.toLowerCase().includes('token') || key.toLowerCase().includes('key') || key.toLowerCase().includes('password') || key.toLowerCase().includes('secret')) {
      return this.crypto.mask(value)
    }
    return value
  }
}
