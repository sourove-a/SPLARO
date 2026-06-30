import { BadRequestException, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createHmac, randomBytes } from 'crypto'
import { google, type Auth } from 'googleapis'
import { PrismaService } from '../../common/prisma.service'
import { resolveStoreId } from '../../common/store.util'
import { EncryptionService } from '../integrations/encryption.service'
import { GOOGLE_OAUTH_SCOPES } from './google.constants'
import { GoogleAuditService } from './google-audit.service'

function b64url(input: string) {
  return Buffer.from(input).toString('base64url')
}

function emailFromIdToken(idToken?: string | null): string | null {
  if (!idToken) return null
  try {
    const payload = JSON.parse(
      Buffer.from(idToken.split('.')[1] ?? '', 'base64url').toString('utf8'),
    ) as { email?: string }
    return payload.email?.trim() || null
  } catch {
    return null
  }
}

@Injectable()
export class GoogleOAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly crypto: EncryptionService,
    private readonly audit: GoogleAuditService,
  ) {}

  resolveClientId(override?: string | null) {
    return override?.trim() || this.config.get<string>('GOOGLE_CLIENT_ID')?.trim() || null
  }

  resolveClientSecret(override?: string | null) {
    return override?.trim() || this.config.get<string>('GOOGLE_CLIENT_SECRET')?.trim() || null
  }

  resolveRedirectUri(override?: string | null) {
    return (
      override?.trim() ||
      this.config.get<string>('GOOGLE_REDIRECT_URI')?.trim() ||
      `${this.config.get<string>('API_URL') ?? 'http://localhost:4000'}/api/v1/admin/google/callback`
    )
  }

  private signState(payload: Record<string, unknown>) {
    const body = b64url(JSON.stringify(payload))
    const sig = createHmac('sha256', this.config.get<string>('ADMIN_SESSION_SECRET') ?? 'splaro-oauth-state')
      .update(body)
      .digest('base64url')
    return `${body}.${sig}`
  }

  verifyState(state: string): { storeId: string; userId?: string; nonce: string } {
    const [body, sig] = state.split('.')
    if (!body || !sig) throw new BadRequestException('Invalid OAuth state')
    const expected = createHmac('sha256', this.config.get<string>('ADMIN_SESSION_SECRET') ?? 'splaro-oauth-state')
      .update(body)
      .digest('base64url')
    if (sig !== expected) throw new BadRequestException('OAuth state signature mismatch')
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as {
      storeId: string
      userId?: string
      nonce: string
      exp: number
    }
    if (!parsed.storeId || parsed.exp < Date.now()) throw new BadRequestException('OAuth state expired')
    return parsed
  }

  async ensureConnection(storeIdRaw: string) {
    const storeId = await resolveStoreId(this.prisma, storeIdRaw)
    return this.prisma.googleWorkspaceConnection.upsert({
      where: { storeId },
      create: {
        storeId,
        clientId: this.resolveClientId(),
        redirectUri: this.resolveRedirectUri(),
        spreadsheetId: this.config.get<string>('GOOGLE_DEFAULT_SPREADSHEET_ID') ?? null,
        driveRootFolderId: this.config.get<string>('GOOGLE_DRIVE_ROOT_FOLDER_ID') ?? null,
      },
      update: {},
    })
  }

  async getOAuthClient(storeIdRaw: string): Promise<Auth.OAuth2Client> {
    const conn = await this.ensureConnection(storeIdRaw)
    const clientId = this.resolveClientId(conn.clientId)
    const envSecret = this.config.get<string>('GOOGLE_CLIENT_SECRET')?.trim() || null
    const dbSecret = conn.clientSecretEncrypted
      ? this.crypto.decrypt(conn.clientSecretEncrypted).trim()
      : null
    const clientSecret = envSecret || dbSecret
    const redirectUri = this.resolveRedirectUri(conn.redirectUri)
    if (!clientId || !clientSecret) {
      throw new BadRequestException('Google Client ID and Client Secret are required in OAuth Settings or .env')
    }
    return new google.auth.OAuth2(clientId, clientSecret, redirectUri)
  }

  resolveLoginHint() {
    return (
      this.config.get<string>('GOOGLE_OAUTH_LOGIN_HINT')?.trim() ||
      this.config.get<string>('ADMIN_EMAIL')?.trim() ||
      this.config.get<string>('CEO_EMAIL')?.trim() ||
      null
    )
  }

  isOAuthConfigured() {
    return Boolean(this.resolveClientId() && this.resolveClientSecret())
  }

  async buildOAuthUrl(storeIdRaw: string, userId?: string) {
    const storeId = await resolveStoreId(this.prisma, storeIdRaw)
    const oauth2 = await this.getOAuthClient(storeId)
    const state = this.signState({
      storeId,
      userId,
      nonce: randomBytes(16).toString('hex'),
      exp: Date.now() + 15 * 60_000,
    })
    const loginHint = this.resolveLoginHint()
    const url = oauth2.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      response_type: 'code',
      scope: [...GOOGLE_OAUTH_SCOPES],
      state,
      ...(loginHint ? { login_hint: loginHint } : {}),
    })
    return {
      url,
      redirectUri: this.resolveRedirectUri(),
      scopes: GOOGLE_OAUTH_SCOPES,
      loginHint,
      configured: this.isOAuthConfigured(),
    }
  }

  private async resolveGoogleEmail(oauth2: Auth.OAuth2Client, tokens: Auth.Credentials) {
    const fromId = emailFromIdToken(tokens.id_token)
    if (fromId) return fromId

    try {
      if (!tokens.access_token) {
        const access = await oauth2.getAccessToken()
        const accessToken = typeof access === 'string' ? access : access?.token
        if (accessToken) {
          oauth2.setCredentials({ ...tokens, access_token: accessToken })
        }
      }
      const profile = await google.oauth2({ version: 'v2', auth: oauth2 }).userinfo.get()
      if (profile.data.email) return profile.data.email
    } catch {
      /* fall through to login hint */
    }

    return this.resolveLoginHint()
  }

  async handleCallback(code: string, state: string) {
    const { storeId, userId } = this.verifyState(state)
    const oauth2 = await this.getOAuthClient(storeId)
    const { tokens } = await oauth2.getToken(code)
    if (!tokens.refresh_token) {
      throw new BadRequestException('Google did not return a refresh token. Revoke app access and reconnect with consent.')
    }

    oauth2.setCredentials(tokens)
    const googleEmail = await this.resolveGoogleEmail(oauth2, tokens)
    if (!googleEmail) {
      throw new BadRequestException('Could not read Google account email. Reconnect and allow email permission.')
    }

    const conn = await this.ensureConnection(storeId)
    const connection = await this.prisma.googleWorkspaceConnection.update({
      where: { id: conn.id },
      data: {
        googleEmail,
        isConnected: true,
        tokenHealth: 'healthy',
        scopes: tokens.scope ?? GOOGLE_OAUTH_SCOPES.join(' '),
        lastError: null,
        updatedBy: userId ?? null,
      },
    })

    await this.prisma.googleWorkspaceToken.upsert({
      where: { connectionId_serviceName: { connectionId: connection.id, serviceName: 'oauth' } },
      create: {
        connectionId: connection.id,
        storeId,
        serviceName: 'oauth',
        accessTokenEncrypted: tokens.access_token ? this.crypto.encrypt(tokens.access_token) : null,
        refreshTokenEncrypted: this.crypto.encrypt(tokens.refresh_token),
        scope: tokens.scope ?? null,
        tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        isConnected: true,
        createdBy: userId ?? null,
        updatedBy: userId ?? null,
      },
      update: {
        accessTokenEncrypted: tokens.access_token ? this.crypto.encrypt(tokens.access_token) : null,
        refreshTokenEncrypted: this.crypto.encrypt(tokens.refresh_token),
        scope: tokens.scope ?? null,
        tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        isConnected: true,
        lastError: null,
        updatedBy: userId ?? null,
      },
    })

    await this.audit.log({
      storeId,
      action: 'CONNECT',
      service: 'oauth',
      message: `Google account connected: ${googleEmail}`,
      userId,
    })

    return { storeId, googleEmail, connected: true }
  }

  async revoke(storeIdRaw: string, userId?: string) {
    const storeId = await resolveStoreId(this.prisma, storeIdRaw)
    const conn = await this.prisma.googleWorkspaceConnection.findUnique({ where: { storeId } })
    if (!conn) return { ok: true, revoked: false }

    const tokenRow = await this.prisma.googleWorkspaceToken.findUnique({
      where: { connectionId_serviceName: { connectionId: conn.id, serviceName: 'oauth' } },
    })

    if (tokenRow?.accessTokenEncrypted) {
      try {
        const oauth2 = await this.getOAuthClient(storeId)
        const access = this.crypto.decrypt(tokenRow.accessTokenEncrypted)
        await oauth2.revokeToken(access)
      } catch {
        /* token may already be invalid */
      }
    }

    await this.prisma.googleWorkspaceToken.deleteMany({
      where: { connectionId: conn.id, serviceName: 'oauth' },
    })

    const saToken = await this.prisma.googleWorkspaceToken.findUnique({
      where: { connectionId_serviceName: { connectionId: conn.id, serviceName: 'service_account' } },
    })
    const saEmail = this.config.get<string>('GOOGLE_SERVICE_ACCOUNT_EMAIL')?.trim() ?? null
    const saStillActive = Boolean(saToken?.isConnected && saEmail)

    await this.prisma.googleWorkspaceConnection.update({
      where: { id: conn.id },
      data: {
        isConnected: saStillActive,
        tokenHealth: saStillActive ? 'healthy' : 'revoked',
        googleEmail: saStillActive ? saEmail : null,
        lastError: null,
        updatedBy: userId ?? null,
      },
    })

    await this.audit.log({
      storeId,
      action: 'REVOKE',
      service: 'oauth',
      message: 'Google access revoked',
      userId,
    })

    return { ok: true, revoked: true }
  }

  async updateOAuthSettings(
    storeIdRaw: string,
    body: { clientId?: string; clientSecret?: string; redirectUri?: string },
    userId?: string,
  ) {
    const storeId = await resolveStoreId(this.prisma, storeIdRaw)
    const conn = await this.ensureConnection(storeId)
    const data: Record<string, unknown> = { updatedBy: userId ?? null }

    if (body.clientId?.trim()) data.clientId = body.clientId.trim()
    if (body.redirectUri?.trim()) data.redirectUri = body.redirectUri.trim()
    if (body.clientSecret?.trim() && !this.crypto.isMaskedInput(body.clientSecret)) {
      data.clientSecretEncrypted = this.crypto.encrypt(body.clientSecret.trim())
    }

    const updated = await this.prisma.googleWorkspaceConnection.update({
      where: { id: conn.id },
      data,
    })

    await this.audit.log({
      storeId,
      action: 'UPDATE_OAUTH_SETTINGS',
      service: 'oauth',
      userId,
    })

    return {
      clientId: updated.clientId ?? this.resolveClientId(),
      clientSecret: updated.clientSecretEncrypted ? '••••••••' : null,
      redirectUri: updated.redirectUri ?? this.resolveRedirectUri(),
    }
  }
}
