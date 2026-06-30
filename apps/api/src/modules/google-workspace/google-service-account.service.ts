import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'
import { google, type Auth } from 'googleapis'
import { PrismaService } from '../../common/prisma.service'
import { resolveStoreId } from '../../common/store.util'
import { GoogleAuditService } from './google-audit.service'

const SA_SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive',
]

@Injectable()
export class GoogleServiceAccountService implements OnModuleInit {
  private readonly logger = new Logger(GoogleServiceAccountService.name)
  private auth: Auth.GoogleAuth | null = null
  private clientEmail: string | null = null

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly audit: GoogleAuditService,
  ) {}

  async onModuleInit() {
    if (!this.isConfigured()) return
    const storeId = this.config.get<string>('NEXT_PUBLIC_STORE_ID') ?? 'splaro'
    await this.activateStore(storeId).catch((e) => {
      this.logger.warn(`Service account auto-activate skipped: ${e}`)
    })
  }

  isConfigured(): boolean {
    return this.config.get<string>('GOOGLE_SERVICE_ACCOUNT_ENABLED') === 'true' && Boolean(this.resolveKeyPath())
  }

  getEmail(): string | null {
    if (this.clientEmail) return this.clientEmail
    return this.config.get<string>('GOOGLE_SERVICE_ACCOUNT_EMAIL')?.trim() || this.readKeyFile()?.client_email || null
  }

  private resolveKeyPath(): string | null {
    const raw =
      this.config.get<string>('GOOGLE_SERVICE_ACCOUNT_KEY_PATH')?.trim() ||
      this.config.get<string>('GOOGLE_APPLICATION_CREDENTIALS')?.trim()
    if (!raw) return null

    const candidates = [
      resolve(process.cwd(), raw),
      resolve(process.cwd(), 'apps/api', raw),
      resolve(process.cwd(), '../../', raw),
    ]
    return candidates.find((p) => existsSync(p)) ?? null
  }

  private readKeyFile(): { client_email?: string; private_key?: string } | null {
    const keyPath = this.resolveKeyPath()
    if (!keyPath) return null
    try {
      return JSON.parse(readFileSync(keyPath, 'utf8')) as { client_email?: string; private_key?: string }
    } catch {
      return null
    }
  }

  async getAuthClient(): Promise<Auth.GoogleAuth> {
    if (this.auth) return this.auth

    const keyPath = this.resolveKeyPath()
    if (!keyPath) {
      throw new Error('Google service account key file not found. Set GOOGLE_SERVICE_ACCOUNT_KEY_PATH in .env')
    }

    this.auth = new google.auth.GoogleAuth({ keyFile: keyPath, scopes: SA_SCOPES })
    this.clientEmail = this.getEmail()
    return this.auth
  }

  async testAccess(spreadsheetId?: string | null) {
    const auth = await this.getAuthClient()
    const sheets = google.sheets({ version: 'v4', auth })
    const email = this.getEmail()

    if (spreadsheetId?.trim()) {
      await sheets.spreadsheets.get({ spreadsheetId: spreadsheetId.trim(), fields: 'spreadsheetId,properties.title' })
      return { ok: true, email, message: `Service account can access spreadsheet ${spreadsheetId}` }
    }

    return { ok: true, email, message: `Service account ready: ${email}` }
  }

  async activateStore(storeIdRaw: string, userId?: string) {
    if (!this.isConfigured()) {
      throw new Error('Service account not configured. Set GOOGLE_SERVICE_ACCOUNT_ENABLED=true and key path in .env')
    }

    const storeId = await resolveStoreId(this.prisma, storeIdRaw)
    const email = this.getEmail()
    if (!email) throw new Error('Service account email missing from key file')

    const existing = await this.prisma.googleWorkspaceConnection.findUnique({ where: { storeId } })
    const oauthToken = existing
      ? await this.prisma.googleWorkspaceToken.findUnique({
          where: { connectionId_serviceName: { connectionId: existing.id, serviceName: 'oauth' } },
        })
      : null
    const preserveOAuthEmail = Boolean(oauthToken?.refreshTokenEncrypted && existing?.googleEmail)

    const conn = await this.prisma.googleWorkspaceConnection.upsert({
      where: { storeId },
      create: {
        storeId,
        googleEmail: email,
        isConnected: true,
        tokenHealth: 'healthy',
        autoSyncEnabled: true,
        scopes: JSON.stringify({ authMode: 'service_account', scopes: SA_SCOPES }),
        spreadsheetId: this.config.get<string>('GOOGLE_DEFAULT_SPREADSHEET_ID') || null,
        createdBy: userId ?? null,
      },
      update: {
        ...(preserveOAuthEmail ? {} : { googleEmail: email }),
        isConnected: true,
        tokenHealth: 'healthy',
        lastError: null,
        scopes: JSON.stringify({ authMode: 'service_account', scopes: SA_SCOPES }),
        updatedBy: userId ?? null,
      },
    })

    const spreadsheetId = conn.spreadsheetId ?? this.config.get<string>('GOOGLE_DEFAULT_SPREADSHEET_ID')
    if (spreadsheetId) {
      await this.testAccess(spreadsheetId)
    } else {
      await this.testAccess()
    }

    await this.prisma.googleWorkspaceToken.upsert({
      where: { connectionId_serviceName: { connectionId: conn.id, serviceName: 'service_account' } },
      create: {
        connectionId: conn.id,
        storeId,
        serviceName: 'service_account',
        isConnected: true,
        scope: SA_SCOPES.join(' '),
        createdBy: userId ?? null,
      },
      update: { isConnected: true, lastError: null, updatedBy: userId ?? null },
    })

    await this.audit.log({
      storeId,
      action: 'ACTIVATE_SERVICE_ACCOUNT',
      service: 'sheets',
      resourceId: email,
      message: `Sheets sync via service account ${email}`,
      userId,
    })

    return {
      ok: true,
      authMode: 'service_account' as const,
      email,
      spreadsheetId: spreadsheetId ?? null,
      message: spreadsheetId
        ? `Connected. Share your sheet with ${email} as Editor if not already.`
        : `Connected. Create spreadsheet or set GOOGLE_DEFAULT_SPREADSHEET_ID, then share sheet with ${email} as Editor.`,
    }
  }

  isServiceAccountStore(storeId: string): boolean {
    if (!this.isConfigured()) return false
    return true
  }

  parseAuthMode(scopes: string | null | undefined): 'service_account' | 'oauth' {
    if (!scopes) return 'oauth'
    try {
      const parsed = JSON.parse(scopes) as { authMode?: string }
      return parsed.authMode === 'service_account' ? 'service_account' : 'oauth'
    } catch {
      return 'oauth'
    }
  }
}
