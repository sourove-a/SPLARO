import { BadRequestException, Injectable } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'
import { resolveStoreId } from '../../common/store.util'
import { GoogleClientService } from './google-client.service'
import { GoogleAuditService } from './google-audit.service'
import { throwGoogleApiError } from './google-api.util'
import { GOOGLE_DRIVE_FOLDERS } from './google.constants'

@Injectable()
export class GoogleGmailService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly client: GoogleClientService,
    private readonly audit: GoogleAuditService,
  ) {}

  async getConfig(storeIdRaw: string) {
    const storeId = await resolveStoreId(this.prisma, storeIdRaw)
    const conn = await this.prisma.googleWorkspaceConnection.findUnique({ where: { storeId } })
    const oauthToken = conn
      ? await this.prisma.googleWorkspaceToken.findUnique({
          where: { connectionId_serviceName: { connectionId: conn.id, serviceName: 'oauth' } },
        })
      : null
    const oauthConnected = Boolean(oauthToken?.refreshTokenEncrypted)
    const settings = await this.prisma.systemSetting.findMany({
      where: { storeId, group: 'google_gmail' },
    })
    const map = Object.fromEntries(settings.map((s) => [s.key, s.value]))

    let senderEmail: string | null = null
    if (oauthConnected) {
      try {
        const auth = await this.client.getAuthenticatedClient(storeId)
        const { google } = await import('googleapis')
        const profile = await google.oauth2({ version: 'v2', auth }).userinfo.get()
        senderEmail = profile.data.email ?? null
      } catch {
        senderEmail = null
      }
    }

    return {
      senderName: map.senderName ?? 'SPLARO',
      senderEmail,
      connected: oauthConnected,
    }
  }

  async updateConfig(storeIdRaw: string, body: { senderName?: string }, userId?: string) {
    const storeId = await resolveStoreId(this.prisma, storeIdRaw)
    if (body.senderName) {
      await this.prisma.systemSetting.upsert({
        where: { storeId_group_key: { storeId, group: 'google_gmail', key: 'senderName' } },
        create: { storeId, group: 'google_gmail', key: 'senderName', value: body.senderName, updatedBy: userId ?? null },
        update: { value: body.senderName, updatedBy: userId ?? null },
      })
    }
    return this.getConfig(storeId)
  }

  private buildMime(to: string, subject: string, html: string, fromName: string, fromEmail: string) {
    const lines = [
      `From: ${fromName} <${fromEmail}>`,
      `To: ${to}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=utf-8',
      '',
      html,
    ]
    return Buffer.from(lines.join('\r\n')).toString('base64url')
  }

  async sendEmail(
    storeIdRaw: string,
    body: { to: string; subject: string; html: string; template?: string },
    userId?: string,
  ) {
    const storeId = await resolveStoreId(this.prisma, storeIdRaw)
    const cfg = await this.getConfig(storeId)
    if (!cfg.connected || !cfg.senderEmail) {
      throw new BadRequestException('Gmail not connected. Connect Google account first.')
    }

    const gmail = await this.client.gmail(storeId)
    const raw = this.buildMime(body.to, body.subject, body.html, cfg.senderName ?? 'SPLARO', cfg.senderEmail)
    const res = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw },
    })

    if (!res.data.id) throw new BadRequestException('Gmail API did not confirm message delivery')

    await this.prisma.notificationDeliveryLog.create({
      data: {
        storeId,
        channel: 'EMAIL',
        recipient: body.to,
        subject: body.subject,
        body: body.html.slice(0, 2000),
        status: 'SENT',
      },
    })

    await this.audit.log({
      storeId,
      action: 'GMAIL_SEND',
      service: 'gmail',
      resourceId: res.data.id,
      message: `Email sent to ${body.to}`,
      userId,
    })

    return { ok: true, messageId: res.data.id, to: body.to }
  }

  async testEmail(storeIdRaw: string, to: string, userId?: string) {
    return this.sendEmail(
      storeIdRaw,
      {
        to,
        subject: 'SPLARO — Gmail test',
        html: '<p>✅ Gmail integration is working. This message was sent via Google Gmail API.</p>',
        template: 'test',
      },
      userId,
    )
  }
}

@Injectable()
export class GoogleDriveService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly client: GoogleClientService,
    private readonly audit: GoogleAuditService,
  ) {}

  async ensureFolderStructure(storeIdRaw: string, userId?: string) {
    const storeId = await resolveStoreId(this.prisma, storeIdRaw)

    try {
      const drive = await this.client.drive(storeId)
      const folderIds: Record<string, string> = {}

      let parentId: string | undefined
      for (const path of GOOGLE_DRIVE_FOLDERS) {
        const name = path.includes('/') ? path.split('/').pop()! : path
        const q = [
          "mimeType='application/vnd.google-apps.folder'",
          `name='${name.replace(/'/g, "\\'")}'`,
          'trashed=false',
          parentId ? `'${parentId}' in parents` : undefined,
        ]
          .filter(Boolean)
          .join(' and ')

        const existing = await drive.files.list({ q, fields: 'files(id,name)', pageSize: 1 })
        let id = existing.data.files?.[0]?.id
        if (!id) {
          const created = await drive.files.create({
            requestBody: {
              name,
              mimeType: 'application/vnd.google-apps.folder',
              ...(parentId ? { parents: [parentId] } : {}),
            },
            fields: 'id',
          })
          id = created.data.id ?? undefined
        }
        if (!id) throw new BadRequestException(`Failed to create Drive folder "${name}"`)
        folderIds[path] = id
        if (!path.includes('/')) parentId = id
      }

      await this.prisma.googleWorkspaceConnection.upsert({
        where: { storeId },
        create: {
          storeId,
          driveRootFolderId: folderIds['SPLARO'] ?? null,
          updatedBy: userId ?? null,
        },
        update: {
          driveRootFolderId: folderIds['SPLARO'] ?? null,
          updatedBy: userId ?? null,
        },
      })

      await this.audit.log({
        storeId,
        action: 'DRIVE_FOLDERS_CREATED',
        service: 'drive',
        metadata: folderIds,
        userId,
      })

      return { folders: folderIds }
    } catch (error) {
      if (error instanceof BadRequestException) throw error
      throwGoogleApiError(error, 'Google Drive folder setup failed')
    }
  }

  async uploadFile(
    storeIdRaw: string,
    body: { name: string; mimeType: string; contentBase64: string; folder?: string },
    userId?: string,
  ) {
    const storeId = await resolveStoreId(this.prisma, storeIdRaw)

    try {
      const conn = await this.prisma.googleWorkspaceConnection.findUnique({ where: { storeId } })
      const drive = await this.client.drive(storeId)
      const parents = conn?.driveRootFolderId ? [conn.driveRootFolderId] : undefined

      const res = await drive.files.create({
        requestBody: { name: body.name, parents },
        media: { mimeType: body.mimeType, body: Buffer.from(body.contentBase64, 'base64') },
        fields: 'id, webViewLink',
      })

      if (!res.data.id) throw new BadRequestException('Drive upload failed — no file ID returned')

      await this.audit.log({
        storeId,
        action: 'DRIVE_UPLOAD',
        service: 'drive',
        resourceId: res.data.id,
        message: `Uploaded ${body.name}`,
        userId,
      })

      return { ok: true, fileId: res.data.id, webViewLink: res.data.webViewLink }
    } catch (error) {
      if (error instanceof BadRequestException) throw error
      throwGoogleApiError(error, 'Google Drive upload failed')
    }
  }
}
