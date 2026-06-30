import { BadRequestException, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../../common/prisma.service'
import { resolveStoreId } from '../../common/store.util'
import { EncryptionService } from '../integrations/encryption.service'
import { GoogleOAuthService } from './google-oauth.service'
import { GoogleClientService } from './google-client.service'
import { GoogleSheetsSyncService } from './google-sheets-sync.service'
import { GoogleGmailService, GoogleDriveService } from './google-gmail-drive.service'
import { GoogleServiceAccountService } from './google-service-account.service'
import { isGoogleServiceAccountEmail } from './google-api.util'

@Injectable()
export class GoogleWorkspaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly crypto: EncryptionService,
    private readonly oauth: GoogleOAuthService,
    private readonly client: GoogleClientService,
    private readonly sheets: GoogleSheetsSyncService,
    private readonly gmail: GoogleGmailService,
    private readonly drive: GoogleDriveService,
    private readonly serviceAccount: GoogleServiceAccountService,
  ) {}

  async getStatus(storeIdRaw: string) {
    const storeId = await resolveStoreId(this.prisma, storeIdRaw)
    const conn = await this.prisma.googleWorkspaceConnection.findUnique({ where: { storeId } })
    const token = conn
      ? await this.prisma.googleWorkspaceToken.findUnique({
          where: { connectionId_serviceName: { connectionId: conn.id, serviceName: 'oauth' } },
        })
      : null

    const spreadsheetId = conn?.spreadsheetId ?? this.config.get<string>('GOOGLE_DEFAULT_SPREADSHEET_ID') ?? null
    const recentLogs = await this.prisma.googleSyncLog.findMany({
      where: { storeId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    })
    const failedCount = await this.prisma.googleSyncLog.count({
      where: { storeId, status: 'failed', createdAt: { gte: new Date(Date.now() - 24 * 3600_000) } },
    })

    const gmailCfg = await this.gmail.getConfig(storeId).catch(() => null)
    const saConfigured = this.serviceAccount.isConfigured()
    const saEmail = saConfigured ? this.serviceAccount.getEmail() : null
    const authMode = conn ? this.serviceAccount.parseAuthMode(conn.scopes) : saConfigured ? 'service_account' : 'oauth'
    const oauthConnected = Boolean(token?.refreshTokenEncrypted)
    const oauthEmail =
      gmailCfg?.senderEmail ??
      (oauthConnected && conn?.googleEmail && !isGoogleServiceAccountEmail(conn.googleEmail)
        ? conn.googleEmail
        : null)
    const sheetsConnected =
      Boolean(conn?.isConnected && spreadsheetId) ||
      (saConfigured && Boolean(conn?.isConnected || spreadsheetId))

    return {
      connected: sheetsConnected || oauthConnected,
      oauthConnected,
      oauthEmail,
      authMode,
      serviceAccountEmail: saEmail,
      serviceAccountConfigured: saConfigured,
      googleEmail: oauthEmail ?? saEmail ?? conn?.googleEmail ?? null,
      tokenHealth: oauthConnected
        ? conn?.tokenHealth ?? 'healthy'
        : saConfigured && conn?.isConnected
          ? 'healthy'
          : conn?.tokenHealth ?? (conn?.isConnected ? 'healthy' : 'missing'),
      tokenExpiry: token?.tokenExpiry?.toISOString() ?? null,
      lastSyncAt: conn?.lastSyncAt?.toISOString() ?? null,
      lastError: conn?.lastError ?? null,
      autoSyncEnabled: conn?.autoSyncEnabled ?? true,
      contactsSyncEnabled: conn?.contactsSyncEnabled ?? false,
      spreadsheetId,
      spreadsheetUrl:
        conn?.spreadsheetUrl ??
        (spreadsheetId ? `https://docs.google.com/spreadsheets/d/${spreadsheetId}` : null),
      driveRootFolderId: conn?.driveRootFolderId ?? this.config.get<string>('GOOGLE_DRIVE_ROOT_FOLDER_ID') ?? null,
      oauth: {
        clientId: conn?.clientId ?? this.oauth.resolveClientId(),
        clientSecret:
          conn?.clientSecretEncrypted || this.oauth.resolveClientSecret()
            ? '••••••••'
            : null,
        redirectUri: conn?.redirectUri ?? this.oauth.resolveRedirectUri(),
        scopesConfigured: Boolean(
          conn?.clientId || this.config.get('GOOGLE_CLIENT_ID'),
        ),
        secretSource: conn?.clientSecretEncrypted
          ? 'database'
          : this.oauth.resolveClientSecret()
            ? 'env'
            : null,
      },
      services: {
        sheets: { connected: sheetsConnected, lastSyncAt: conn?.lastSyncAt?.toISOString() ?? null },
        gmail: { connected: Boolean(gmailCfg?.connected), senderEmail: gmailCfg?.senderEmail ?? oauthEmail },
        drive: {
          connected: Boolean(conn?.driveRootFolderId),
          folderId: conn?.driveRootFolderId || null,
        },
        docs: { connected: oauthConnected },
        calendar: { connected: oauthConnected },
        contacts: { connected: oauthConnected && Boolean(conn?.contactsSyncEnabled) },
        analytics: { connected: oauthConnected },
        searchConsole: { connected: oauthConnected },
        merchant: { connected: oauthConnected },
      },
      recentFailures24h: failedCount,
      recentLogs,
    }
  }

  async testConnection(storeIdRaw: string) {
    const storeId = await resolveStoreId(this.prisma, storeIdRaw)

    if (this.serviceAccount.isConfigured()) {
      const conn = await this.prisma.googleWorkspaceConnection.findUnique({ where: { storeId } })
      const spreadsheetId = conn?.spreadsheetId ?? this.config.get<string>('GOOGLE_DEFAULT_SPREADSHEET_ID')
      const result = await this.serviceAccount.testAccess(spreadsheetId)
      return { ok: true, message: result.message, email: result.email, authMode: 'service_account' as const }
    }

    const auth = await this.client.getAuthenticatedClient(storeId)
    const { google } = await import('googleapis')
    const oauth2 = google.oauth2({ version: 'v2', auth })
    const profile = await oauth2.userinfo.get()
    if (!profile.data.email) throw new BadRequestException('Google API test failed — no profile email')

    await this.prisma.googleWorkspaceConnection.update({
      where: { storeId },
      data: { tokenHealth: 'healthy', googleEmail: profile.data.email, lastError: null },
    })

    return {
      ok: true,
      message: `Google API connected as ${profile.data.email}`,
      email: profile.data.email,
    }
  }

  async getSyncLogs(storeIdRaw: string, page = 1, limit = 30) {
    const storeId = await resolveStoreId(this.prisma, storeIdRaw)
    const skip = (page - 1) * limit
    const [items, total] = await Promise.all([
      this.prisma.googleSyncLog.findMany({
        where: { storeId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.googleSyncLog.count({ where: { storeId } }),
    ])
    return { items, total, page, totalPages: Math.ceil(total / limit) }
  }

  async getAuditLogs(storeIdRaw: string, page = 1, limit = 30) {
    const storeId = await resolveStoreId(this.prisma, storeIdRaw)
    const skip = (page - 1) * limit
    const [items, total] = await Promise.all([
      this.prisma.googleAuditLog.findMany({
        where: { storeId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.googleAuditLog.count({ where: { storeId } }),
    ])
    return { items, total, page, totalPages: Math.ceil(total / limit) }
  }

  async retryFailed(storeIdRaw: string, userId?: string) {
    const storeId = await resolveStoreId(this.prisma, storeIdRaw)
    const failed = await this.prisma.googleSyncLog.findMany({
      where: { storeId, status: 'failed' },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    return { retried: failed.length, message: 'Re-queue failed syncs via manual full sync' }
  }

  sheetsService() {
    return this.sheets
  }

  gmailService() {
    return this.gmail
  }

  driveService() {
    return this.drive
  }

  oauthService() {
    return this.oauth
  }

  serviceAccountService() {
    return this.serviceAccount
  }
}
