import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Put,
  Query,
  Req,
  Res,
} from '@nestjs/common'
import type { Request, Response } from 'express'
import { Public } from '../../common/auth/public.decorator'
import { canWriteAdmin } from '../../common/auth/admin-session.util'
import type { AdminSessionPayload } from '../../common/auth/admin-session.util'
import { GoogleWorkspaceService } from './google-workspace.service'
import { GoogleSyncQueueService } from './google-sync-queue.service'
import { GOOGLE_SYNC_JOB_TYPES } from './google.constants'

type AdminRequest = Request & { adminUser?: AdminSessionPayload }

@Controller('admin/google')
export class GoogleWorkspaceController {
  constructor(
    private readonly google: GoogleWorkspaceService,
    private readonly syncQueue: GoogleSyncQueueService,
  ) {}

  private assertWrite(req: AdminRequest) {
    const role = req.adminUser?.role
    if (!role || !canWriteAdmin(role)) throw new ForbiddenException('Insufficient permissions')
    return req.adminUser!.userId
  }

  @Get('status')
  status(@Query('storeId') storeId: string) {
    return this.google.getStatus(storeId)
  }

  @Get('oauth-url')
  oauthUrl(@Query('storeId') storeId: string, @Req() req: AdminRequest) {
    return this.google.oauthService().buildOAuthUrl(storeId, req.adminUser?.userId)
  }

  @Public()
  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') oauthError: string,
    @Res() res: Response,
  ) {
    const adminUrl = process.env['ADMIN_URL'] ?? process.env['NEXT_PUBLIC_ADMIN_URL'] ?? 'http://localhost:3001'
    if (oauthError?.trim()) {
      const message =
        oauthError === 'access_denied'
          ? 'Google login cancelled — Allow দিয়ে আবার চেষ্টা করুন।'
          : oauthError
      res.redirect(`${adminUrl}/dashboard/google-workspace/connect?error=${encodeURIComponent(message)}`)
      return
    }
    if (!code?.trim() || !state?.trim()) {
      res.redirect(
        `${adminUrl}/dashboard/google-workspace/connect?error=${encodeURIComponent('Missing OAuth code — Connect বাটন আবার চাপুন।')}`,
      )
      return
    }
    try {
      const result = await this.google.oauthService().handleCallback(code, state)
      res.redirect(
        `${adminUrl}/dashboard/google-workspace/connect?connected=1&email=${encodeURIComponent(result.googleEmail ?? '')}`,
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Google connection failed'
      res.redirect(
        `${adminUrl}/dashboard/google-workspace/connect?error=${encodeURIComponent(message)}`,
      )
    }
  }

  @Post('revoke')
  revoke(@Query('storeId') storeId: string, @Req() req: AdminRequest) {
    const userId = this.assertWrite(req)
    return this.google.oauthService().revoke(storeId, userId)
  }

  @Post('test')
  test(@Query('storeId') storeId: string, @Query('mode') mode?: 'gmail' | 'sheets' | 'auto') {
    return this.google.testConnection(storeId, mode)
  }

  @Put('oauth-settings')
  oauthSettings(
    @Query('storeId') storeId: string,
    @Body() body: { clientId?: string; clientSecret?: string; redirectUri?: string },
    @Req() req: AdminRequest,
  ) {
    const userId = this.assertWrite(req)
    return this.google.oauthService().updateOAuthSettings(storeId, body, userId)
  }

  @Get('sheets/config')
  sheetsConfig(@Query('storeId') storeId: string) {
    return this.google.sheetsService().getSheetConfigs(storeId)
  }

  @Post('service-account/activate')
  activateServiceAccount(@Query('storeId') storeId: string, @Req() req: AdminRequest) {
    const userId = this.assertWrite(req)
    return this.google.serviceAccountService().activateStore(storeId, userId)
  }

  @Post('sheets/link')
  linkSpreadsheet(
    @Query('storeId') storeId: string,
    @Body() body: { spreadsheetId?: string; spreadsheetUrl?: string },
    @Req() req: AdminRequest,
  ) {
    const userId = this.assertWrite(req)
    const raw = body.spreadsheetId?.trim() || body.spreadsheetUrl?.trim() || ''
    const match = raw.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
    const spreadsheetId = match?.[1] ?? raw
    return this.google.sheetsService().linkExistingSpreadsheet(storeId, spreadsheetId, userId)
  }

  @Post('sheets/create-default')
  createSpreadsheet(@Query('storeId') storeId: string, @Req() req: AdminRequest) {
    const userId = this.assertWrite(req)
    return this.google.sheetsService().createDefaultSpreadsheet(storeId, userId)
  }

  @Put('sheets/auto-sync')
  toggleAutoSync(
    @Query('storeId') storeId: string,
    @Body() body: { enabled: boolean },
    @Req() req: AdminRequest,
  ) {
    const userId = this.assertWrite(req)
    return this.google.sheetsService().toggleAutoSync(storeId, body.enabled, userId)
  }

  @Post('sheets/sync-now')
  async syncNow(
    @Query('storeId') storeId: string,
    @Body() body: { jobType?: string; resourceId?: string },
    @Req() req: AdminRequest,
  ) {
    const userId = this.assertWrite(req)
    if (body.jobType === GOOGLE_SYNC_JOB_TYPES.FULL_BACKUP || !body.jobType) {
      return this.syncQueue.manualFullSync(storeId, userId)
    }
    return this.syncQueue.enqueue({
      storeId,
      jobType: body.jobType,
      resourceId: body.resourceId,
      triggeredBy: userId,
    })
  }

  @Post('sheets/retry-failed')
  retryFailed(@Query('storeId') storeId: string, @Req() req: AdminRequest) {
    const userId = this.assertWrite(req)
    return this.google.retryFailed(storeId, userId)
  }

  @Get('sync-logs')
  syncLogs(
    @Query('storeId') storeId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.google.getSyncLogs(storeId, Number(page) || 1, Number(limit) || 30)
  }

  @Get('audit-logs')
  auditLogs(
    @Query('storeId') storeId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.google.getAuditLogs(storeId, Number(page) || 1, Number(limit) || 30)
  }

  @Get('gmail/config')
  gmailConfig(@Query('storeId') storeId: string) {
    return this.google.gmailService().getConfig(storeId)
  }

  @Put('gmail/config')
  updateGmailConfig(
    @Query('storeId') storeId: string,
    @Body() body: { senderName?: string },
    @Req() req: AdminRequest,
  ) {
    const userId = this.assertWrite(req)
    return this.google.gmailService().updateConfig(storeId, body, userId)
  }

  @Post('gmail/test')
  gmailTest(
    @Query('storeId') storeId: string,
    @Body() body: { to: string },
    @Req() req: AdminRequest,
  ) {
    const userId = this.assertWrite(req)
    return this.google.gmailService().testEmail(storeId, body.to, userId)
  }

  @Post('gmail/send')
  gmailSend(
    @Query('storeId') storeId: string,
    @Body() body: { to: string; subject: string; html: string; template?: string },
    @Req() req: AdminRequest,
  ) {
    const userId = this.assertWrite(req)
    return this.google.gmailService().sendEmail(storeId, body, userId)
  }

  @Post('drive/folders')
  driveFolders(@Query('storeId') storeId: string, @Req() req: AdminRequest) {
    const userId = this.assertWrite(req)
    return this.google.driveService().ensureFolderStructure(storeId, userId)
  }

  @Post('drive/upload')
  driveUpload(
    @Query('storeId') storeId: string,
    @Body() body: { name: string; mimeType: string; contentBase64: string; folder?: string },
    @Req() req: AdminRequest,
  ) {
    const userId = this.assertWrite(req)
    return this.google.driveService().uploadFile(storeId, body, userId)
  }
}
