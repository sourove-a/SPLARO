import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { google, type Auth } from 'googleapis'
import type { PrismaClient } from '@splaro/database'
import { PrismaService } from '../../common/prisma.service'
import { resolveStoreId } from '../../common/store.util'
import { EncryptionService } from '../integrations/encryption.service'
import { GoogleOAuthService } from './google-oauth.service'
import { GoogleServiceAccountService } from './google-service-account.service'
import {
  isSheetsAuthFailure,
  readEncryptedRefreshToken,
  REFRESH_TOKEN_MISSING,
} from './google-sheets-auth.util'

function asPrisma(db: PrismaService): PrismaClient {
  return db
}

@Injectable()
export class GoogleClientService {
  private readonly logger = new Logger(GoogleClientService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: EncryptionService,
    private readonly oauth: GoogleOAuthService,
    private readonly serviceAccount: GoogleServiceAccountService,
  ) {}

  async canUseSheets(storeIdRaw: string): Promise<{ ok: true; mode: 'sa' | 'oauth' } | { ok: false; reason: string }> {
    const storeId = await resolveStoreId(this.prisma, storeIdRaw)
    if (this.serviceAccount.isConfigured()) return { ok: true, mode: 'sa' }

    const db = asPrisma(this.prisma)
    const conn = await db.googleWorkspaceConnection.findUnique({ where: { storeId } })
    if (this.serviceAccount.parseAuthMode(conn?.scopes) === 'service_account') {
      return {
        ok: false,
        reason:
          'Google service account key not loaded. Set GOOGLE_SERVICE_ACCOUNT_KEY_PATH (or disable auto-sync until the key is on this host).',
      }
    }

    const tokenRow = conn
      ? await db.googleWorkspaceToken.findUnique({
          where: { connectionId_serviceName: { connectionId: conn.id, serviceName: 'oauth' } },
          select: { refreshTokenEncrypted: true },
        })
      : null
    const refresh = readEncryptedRefreshToken(tokenRow?.refreshTokenEncrypted, (value) =>
      this.crypto.decrypt(value),
    )
    if (refresh.ok) return { ok: true, mode: 'oauth' }

    return {
      ok: false,
      reason: tokenRow?.refreshTokenEncrypted
        ? refresh.reason
        : 'Google account not connected. Connect in Google Workspace → Connect Google Account.',
    }
  }

  /** Stop the live cron from retrying an unfixable auth state. Always persist tokenHealth. */
  async pauseLiveSync(storeIdRaw: string, reason: string): Promise<boolean> {
    const storeId = await resolveStoreId(this.prisma, storeIdRaw)
    const existing = await this.prisma.googleWorkspaceConnection.findUnique({
      where: { storeId },
      select: { autoSyncEnabled: true },
    })
    const result = await this.prisma.googleWorkspaceConnection.updateMany({
      where: { storeId },
      data: {
        autoSyncEnabled: false,
        tokenHealth: 'needs_reconnect',
        lastError: reason.slice(0, 500),
      },
    })
    const paused = Boolean(existing?.autoSyncEnabled) && result.count > 0
    if (paused) {
      this.logger.warn(`Paused Google Sheets auto-sync for ${storeId}: ${reason}`)
    }
    return paused
  }

  async resumeLiveSync(storeIdRaw: string): Promise<void> {
    const storeId = await resolveStoreId(this.prisma, storeIdRaw)
    const ready = await this.canUseSheets(storeId)
    if (!ready.ok) throw new BadRequestException(ready.reason)
    await this.prisma.googleWorkspaceConnection.updateMany({
      where: { storeId },
      data: { autoSyncEnabled: true, tokenHealth: 'healthy', lastError: null },
    })
  }

  async getSheetsAuth(storeId: string): Promise<Auth.GoogleAuth | Auth.OAuth2Client> {
    const ready = await this.canUseSheets(storeId)
    if (!ready.ok) throw new BadRequestException(ready.reason)
    if (ready.mode === 'sa') return this.serviceAccount.getAuthClient()
    return this.getOAuthClient(storeId)
  }

  async getAuthenticatedClient(storeIdRaw: string): Promise<Auth.OAuth2Client> {
    return this.getOAuthClient(storeIdRaw)
  }

  private async getOAuthClient(storeIdRaw: string): Promise<Auth.OAuth2Client> {
    const storeId = await resolveStoreId(this.prisma, storeIdRaw)
    const db = asPrisma(this.prisma)
    const conn = await db.googleWorkspaceConnection.findUnique({ where: { storeId } })
    if (!conn?.isConnected) {
      if (this.serviceAccount.isConfigured()) {
        throw new BadRequestException(
          'Google Sheets uses service account. Activate it in Google Workspace → Sheets Sync, or share your sheet with the service account email.',
        )
      }
      throw new BadRequestException('Google account not connected. Connect in Google Workspace → Connect Google Account.')
    }

    const tokenRow = await db.googleWorkspaceToken.findUnique({
      where: { connectionId_serviceName: { connectionId: conn.id, serviceName: 'oauth' } },
    })
    const refresh = readEncryptedRefreshToken(tokenRow?.refreshTokenEncrypted, (value) =>
      this.crypto.decrypt(value),
    )
    if (!refresh.ok) {
      await this.markTokenUnhealthy(storeId, refresh.reason)
      throw new BadRequestException(refresh.reason)
    }

    const oauth2 = await this.oauth.getOAuthClient(storeId)
    oauth2.setCredentials({
      access_token: tokenRow?.accessTokenEncrypted
        ? this.crypto.decrypt(tokenRow.accessTokenEncrypted)
        : undefined,
      refresh_token: refresh.token,
      expiry_date: tokenRow?.tokenExpiry?.getTime(),
    })

    oauth2.on('tokens', async (tokens) => {
      if (!tokenRow) return
      if (!tokens.access_token && !tokens.refresh_token) return
      await db.googleWorkspaceToken.update({
        where: { id: tokenRow.id },
        data: {
          ...(tokens.access_token ? { accessTokenEncrypted: this.crypto.encrypt(tokens.access_token) } : {}),
          ...(tokens.refresh_token ? { refreshTokenEncrypted: this.crypto.encrypt(tokens.refresh_token) } : {}),
          ...(tokens.expiry_date ? { tokenExpiry: new Date(tokens.expiry_date) } : {}),
          isConnected: true,
        },
      })
      await db.googleWorkspaceConnection.update({
        where: { id: conn.id },
        data: { tokenHealth: 'healthy', lastError: null },
      })
    })

    try {
      await oauth2.getAccessToken()
      await this.clearUnhealthyToken(conn.id, conn.tokenHealth)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (isSheetsAuthFailure(msg) || /invalid_grant|invalid credentials/i.test(msg)) {
        const reason = 'Google token expired or revoked. Reconnect your Google account.'
        await this.markTokenUnhealthy(storeId, reason)
        throw new BadRequestException(reason)
      }
      throw err
    }

    return oauth2
  }

  /**
   * Take the reconnect flag back off once the credentials demonstrably work.
   *
   * The `tokens` handler above already does this, but only when Google actually
   * mints a new token — so a store whose cached access token was still valid
   * stayed flagged through sync after successful sync, and the dashboard kept
   * telling the operator to reconnect an account that was working. Nothing else
   * clears it either: the reconnect callback, `resumeLiveSync` and linking a
   * spreadsheet all do, but an ordinary sync never did.
   *
   * Reaching here is the same proof that handler waits for. `getOAuthClient`
   * refuses to build a client at all without a decryptable refresh token, and
   * `getAccessToken` has just been accepted by Google — which is exactly the
   * pair of facts `needs_reconnect` asserts are false.
   *
   * `autoSyncEnabled` is deliberately left alone: `markTokenUnhealthy` turns it
   * off to stop the cron hammering a broken account, and turning it back on is
   * the operator's call, not a side effect of one manual sync.
   */
  private async clearUnhealthyToken(
    connectionId: string,
    currentHealth: string | null,
  ): Promise<void> {
    if (!currentHealth || currentHealth === 'healthy') return
    try {
      await this.prisma.googleWorkspaceConnection.update({
        where: { id: connectionId },
        data: { tokenHealth: 'healthy', lastError: null },
      })
    } catch {
      // Bookkeeping only — a sync that works must not fail on the status write.
    }
  }

  private async markTokenUnhealthy(storeId: string, reason: string): Promise<void> {
    await this.prisma.googleWorkspaceConnection.updateMany({
      where: { storeId },
      data: {
        autoSyncEnabled: false,
        tokenHealth: 'needs_reconnect',
        lastError: (reason || REFRESH_TOKEN_MISSING).slice(0, 500),
      },
    })
  }

  async getDriveAuth(storeIdRaw: string): Promise<Auth.GoogleAuth | Auth.OAuth2Client> {
    const storeId = await resolveStoreId(this.prisma, storeIdRaw)
    const db = asPrisma(this.prisma)
    const conn = await db.googleWorkspaceConnection.findUnique({ where: { storeId } })
    if (conn) {
      const oauthToken = await db.googleWorkspaceToken.findUnique({
        where: { connectionId_serviceName: { connectionId: conn.id, serviceName: 'oauth' } },
      })
      if (oauthToken?.refreshTokenEncrypted) {
        return this.getOAuthClient(storeIdRaw)
      }
    }

    if (this.serviceAccount.isConfigured()) {
      return this.serviceAccount.getAuthClient()
    }

    throw new BadRequestException(
      'Google Drive not ready. Connect your Google account in Google Workspace, or enable the service account.',
    )
  }

  async sheets(storeId: string) {
    const auth = await this.getSheetsAuth(storeId)
    return google.sheets({ version: 'v4', auth })
  }

  async drive(storeId: string) {
    const auth = await this.getDriveAuth(storeId)
    return google.drive({ version: 'v3', auth })
  }

  async gmail(storeId: string) {
    const auth = await this.getOAuthClient(storeId)
    return google.gmail({ version: 'v1', auth })
  }

  async docs(storeId: string) {
    const auth = await this.getSheetsAuth(storeId)
    return google.docs({ version: 'v1', auth })
  }

  async calendar(storeId: string) {
    const auth = await this.getOAuthClient(storeId)
    return google.calendar({ version: 'v3', auth })
  }
}
