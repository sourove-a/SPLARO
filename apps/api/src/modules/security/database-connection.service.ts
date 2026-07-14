import { BadRequestException, ForbiddenException, Injectable, Logger } from '@nestjs/common'
import { PrismaClient } from '@splaro/database'
import type { AdminSessionPayload } from '../../common/auth/admin-session.util'
import { PrismaService } from '../../common/prisma.service'
import { resolveStoreId } from '../../common/store.util'
import { EncryptionService } from '../integrations/encryption.service'

export interface DatabaseConnectionInfo {
  host: string
  port: string
  database: string
  user: string
  passwordSet: boolean
  connected: boolean
  source: 'environment' | 'database'
  savedInDatabase: boolean
  requiresRestart: boolean
}

export interface DatabaseCredentialsInput {
  /** Full postgres URL — wins over the individual fields when present. */
  url?: string
  host?: string
  port?: string | number
  database?: string
  user?: string
  password?: string
}

const DB_SETTING_GROUP = 'infrastructure'
const DB_SETTING_KEY = 'database_url'
const TEST_TIMEOUT_MS = Number(process.env['DATABASE_TEST_TIMEOUT_MS'] ?? 20_000)

@Injectable()
export class DatabaseConnectionService {
  private readonly logger = new Logger(DatabaseConnectionService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: EncryptionService,
  ) {}

  private requireSuperAdmin(actor?: AdminSessionPayload) {
    if (actor?.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Only SUPER_ADMIN can manage database credentials')
    }
  }

  private parseUrl(raw: string): URL | null {
    try {
      return new URL(raw)
    } catch {
      return null
    }
  }

  private urlFromParsed(parsed: URL | null) {
    return {
      host: parsed?.hostname ?? '',
      port: parsed?.port ?? '5432',
      database: parsed?.pathname.replace(/^\//, '') ?? '',
      user: parsed ? decodeURIComponent(parsed.username) : '',
      passwordSet: Boolean(parsed?.password),
    }
  }

  private async resolveStoreId(actor?: AdminSessionPayload) {
    return resolveStoreId(this.prisma, actor?.storeId ?? 'splaro')
  }

  private async readSavedUrl(storeId: string): Promise<string | null> {
    const row = await this.prisma.systemSetting.findUnique({
      where: {
        storeId_group_key: { storeId, group: DB_SETTING_GROUP, key: DB_SETTING_KEY },
      },
      select: { encryptedValue: true },
    })
    if (!row?.encryptedValue) return null
    try {
      return this.crypto.decrypt(row.encryptedValue)
    } catch (err) {
      this.logger.warn(`Could not decrypt saved DATABASE_URL: ${err instanceof Error ? err.message : err}`)
      return null
    }
  }

  private buildUrl(input: DatabaseCredentialsInput): string {
    if (input.url?.trim()) {
      const parsed = this.parseUrl(input.url.trim())
      if (!parsed || !/^postgres(ql)?:$/.test(parsed.protocol)) {
        throw new BadRequestException('DATABASE_URL must be a postgresql:// URL')
      }
      return input.url.trim()
    }

    const current = this.parseUrl(process.env['DATABASE_URL'] ?? '')
    const host = input.host?.trim() || current?.hostname
    const port = String(input.port ?? '').trim() || current?.port || '5432'
    const database = input.database?.trim() || current?.pathname.replace(/^\//, '')
    const user = input.user?.trim() || (current ? decodeURIComponent(current.username) : '')
    const password = input.password ?? (current ? decodeURIComponent(current.password) : '')

    if (!host || !database || !user) {
      throw new BadRequestException('host, database and user are required (or provide a full url)')
    }
    return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`
  }

  private async probe(url: string): Promise<{ ok: boolean; message: string }> {
    const client = new PrismaClient({ datasources: { db: { url } } })
    try {
      await Promise.race([
        client.$queryRaw`SELECT 1`,
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error(`Connection timed out after ${TEST_TIMEOUT_MS / 1000}s`)),
            TEST_TIMEOUT_MS,
          ),
        ),
      ])
      return { ok: true, message: 'Database connection verified.' }
    } catch (err) {
      const message = err instanceof Error ? err.message.split('\n').pop()?.trim() || err.message : 'Connection failed'
      return { ok: false, message }
    } finally {
      await client.$disconnect().catch(() => undefined)
    }
  }

  async info(actor?: AdminSessionPayload): Promise<DatabaseConnectionInfo> {
    this.requireSuperAdmin(actor)
    const storeId = await this.resolveStoreId(actor)
    const activeRaw = process.env['DATABASE_URL'] ?? ''
    const savedRaw = await this.readSavedUrl(storeId)
    const displayRaw = savedRaw ?? activeRaw
    const parsed = this.parseUrl(displayRaw)
    const probe = activeRaw ? await this.probe(activeRaw) : { ok: false }
    const fields = this.urlFromParsed(parsed)
    const requiresRestart = Boolean(savedRaw && savedRaw !== activeRaw)

    return {
      ...fields,
      connected: probe.ok,
      source: savedRaw ? 'database' : 'environment',
      savedInDatabase: Boolean(savedRaw),
      requiresRestart,
    }
  }

  async test(input: DatabaseCredentialsInput, actor?: AdminSessionPayload) {
    this.requireSuperAdmin(actor)
    const url = this.buildUrl(input)
    return this.probe(url)
  }

  async save(input: DatabaseCredentialsInput, actor?: AdminSessionPayload) {
    this.requireSuperAdmin(actor)
    const url = this.buildUrl(input)

    const probe = await this.probe(url)
    if (!probe.ok) {
      throw new BadRequestException(`Refusing to save — connection test failed: ${probe.message}`)
    }

    const storeId = await this.resolveStoreId(actor)
    const encrypted = this.crypto.encrypt(url)

    await this.prisma.systemSetting.upsert({
      where: {
        storeId_group_key: { storeId, group: DB_SETTING_GROUP, key: DB_SETTING_KEY },
      },
      create: {
        storeId,
        group: DB_SETTING_GROUP,
        key: DB_SETTING_KEY,
        encryptedValue: encrypted,
        updatedBy: actor?.userId,
      },
      update: {
        encryptedValue: encrypted,
        updatedBy: actor?.userId,
      },
    })

    this.logger.log(`DATABASE_URL saved to SystemSetting by ${actor?.email} (restart required to apply)`)

    return {
      ok: true,
      message:
        'Database credentials saved to database and connection verified. Restart the API so all connections use the new URL.',
      savedToDatabase: true,
    }
  }
}
