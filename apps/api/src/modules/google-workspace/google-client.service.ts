import { BadRequestException, Injectable } from '@nestjs/common'
import { google, type Auth } from 'googleapis'
import type { PrismaClient } from '@splaro/database'
import { PrismaService } from '../../common/prisma.service'
import { resolveStoreId } from '../../common/store.util'
import { EncryptionService } from '../integrations/encryption.service'
import { GoogleOAuthService } from './google-oauth.service'
import { GoogleServiceAccountService } from './google-service-account.service'

function asPrisma(db: PrismaService): PrismaClient {
  return db
}

@Injectable()
export class GoogleClientService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: EncryptionService,
    private readonly oauth: GoogleOAuthService,
    private readonly serviceAccount: GoogleServiceAccountService,
  ) {}

  async getSheetsAuth(storeId: string): Promise<Auth.GoogleAuth | Auth.OAuth2Client> {
    if (this.serviceAccount.isConfigured()) {
      return this.serviceAccount.getAuthClient()
    }
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
    if (!tokenRow?.refreshTokenEncrypted) {
      throw new BadRequestException('Google refresh token missing. Reconnect your Google account.')
    }

    const oauth2 = await this.oauth.getOAuthClient(storeId)
    oauth2.setCredentials({
      access_token: tokenRow.accessTokenEncrypted ? this.crypto.decrypt(tokenRow.accessTokenEncrypted) : undefined,
      refresh_token: this.crypto.decrypt(tokenRow.refreshTokenEncrypted),
      expiry_date: tokenRow.tokenExpiry?.getTime(),
    })

    oauth2.on('tokens', async (tokens) => {
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

    return oauth2
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
