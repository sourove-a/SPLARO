import { BadRequestException, ForbiddenException, Injectable, Logger } from '@nestjs/common'
import { PrismaClient } from '@splaro/database'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { homedir } from 'os'
import { dirname, join, resolve } from 'path'
import type { AdminSessionPayload } from '../../common/auth/admin-session.util'

export interface DatabaseConnectionInfo {
  host: string
  port: string
  database: string
  user: string
  passwordSet: boolean
  connected: boolean
  source: string
  envFile: string | null
  backupFile: string | null
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

const TEST_TIMEOUT_MS = 10_000

@Injectable()
export class DatabaseConnectionService {
  private readonly logger = new Logger(DatabaseConnectionService.name)

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

  /** Nearest .env walking up from cwd — repo root in dev, .builds source on Hostinger. */
  private findEnvFile(): string | null {
    const override = process.env['SPLARO_ENV_FILE']?.trim()
    if (override && existsSync(override)) return override
    let dir = process.cwd()
    for (let i = 0; i < 6; i += 1) {
      const candidate = join(dir, '.env')
      if (existsSync(candidate)) return candidate
      const parent = dirname(dir)
      if (parent === dir) break
      dir = parent
    }
    return null
  }

  /** Hostinger watchdog restores .env from this file — keep it in sync or a redeploy reverts the password. */
  private findBackupFile(): string | null {
    const override = process.env['SPLARO_ENV_BACKUP_FILE']?.trim()
    if (override && existsSync(override)) return override
    const fallback = resolve(homedir(), 'splaro-env-backup.env')
    return existsSync(fallback) ? fallback : null
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
          setTimeout(() => reject(new Error('Connection timed out after 10s')), TEST_TIMEOUT_MS),
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

  private writeEnvLine(file: string, url: string) {
    const content = readFileSync(file, 'utf8')
    const line = `DATABASE_URL=${url}`
    const updated = /^DATABASE_URL=.*$/m.test(content)
      ? content.replace(/^DATABASE_URL=.*$/m, line)
      : `${content.replace(/\n*$/, '\n')}${line}\n`
    writeFileSync(file, updated, 'utf8')
  }

  async info(actor?: AdminSessionPayload): Promise<DatabaseConnectionInfo> {
    this.requireSuperAdmin(actor)
    const raw = process.env['DATABASE_URL'] ?? ''
    const parsed = this.parseUrl(raw)
    const probe = raw ? await this.probe(raw) : { ok: false }
    return {
      host: parsed?.hostname ?? '',
      port: parsed?.port ?? '5432',
      database: parsed?.pathname.replace(/^\//, '') ?? '',
      user: parsed ? decodeURIComponent(parsed.username) : '',
      passwordSet: Boolean(parsed?.password),
      connected: probe.ok,
      source: process.env['SPLARO_ENV_FILE'] ? 'env-file-override' : 'environment',
      envFile: this.findEnvFile(),
      backupFile: this.findBackupFile(),
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

    const envFile = this.findEnvFile()
    if (!envFile) {
      throw new BadRequestException('No .env file found on the server (set SPLARO_ENV_FILE)')
    }

    const written: string[] = [envFile]
    this.writeEnvLine(envFile, url)

    const backupFile = this.findBackupFile()
    if (backupFile) {
      try {
        this.writeEnvLine(backupFile, url)
        written.push(backupFile)
      } catch (err) {
        this.logger.warn(`Could not update env backup ${backupFile}: ${err instanceof Error ? err.message : err}`)
      }
    }

    process.env['DATABASE_URL'] = url
    this.logger.log(`DATABASE_URL updated by ${actor?.email} → ${written.join(', ')}`)

    return {
      ok: true,
      message:
        'Database credentials saved and verified. Restart the API (watchdog picks this up automatically on Hostinger) so all connections use the new password.',
      files: written,
    }
  }
}
