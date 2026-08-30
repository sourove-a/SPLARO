import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common'
import type { Request } from 'express'
import type { GoogleSheetType } from '@prisma/client'
import { RequireFeature } from '../../common/auth/require-feature.decorator'
import type { AdminSessionPayload } from '../../common/auth/admin-session.util'
import { GoogleSheetsService } from './google-sheets.service'

type AdminRequest = Request & { adminUser?: AdminSessionPayload }

@RequireFeature('googleSheets')
@Controller('google-sheets')
export class GoogleSheetsController {
  constructor(private readonly sheets: GoogleSheetsService) {}

  private scopedStoreId(req: AdminRequest, storeId: string) {
    return req.adminUser?.storeId ?? storeId
  }

  @Get('dashboard')
  dashboard(@Query('storeId') storeId: string, @Req() req: AdminRequest) {
    return this.sheets.dashboard(this.scopedStoreId(req, storeId))
  }

  @Get('logs')
  logs(
    @Query('storeId') storeId: string,
    @Req() req: AdminRequest,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.sheets.logs(this.scopedStoreId(req, storeId), Number(page) || 1, Number(limit) || 30)
  }

  @Post('sync')
  sync(
    @Query('storeId') storeId: string,
    @Body()
    body: {
      sheetType: GoogleSheetType
      resourceId?: string
      resourceType?: string
      triggeredBy?: string
    },
    @Req() req: AdminRequest,
  ) {
    return this.sheets.sync(
      this.scopedStoreId(req, storeId),
      body.sheetType,
      body.resourceId,
      body.resourceType,
      body.triggeredBy,
    )
  }

  @Post('sync-all')
  syncAll(
    @Query('storeId') storeId: string,
    @Body() body: { triggeredBy?: string },
    @Req() req: AdminRequest,
  ) {
    return this.sheets.syncAll(this.scopedStoreId(req, storeId), body.triggeredBy)
  }

  @Post('retry-failed')
  retryFailed(@Query('storeId') storeId: string, @Req() req: AdminRequest) {
    return this.sheets.retryFailed(this.scopedStoreId(req, storeId))
  }
}
