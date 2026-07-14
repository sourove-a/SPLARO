import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import type { GoogleSheetType } from '@prisma/client'
import { RequireFeature } from '../../common/auth/require-feature.decorator'
import { GoogleSheetsService } from './google-sheets.service'

@RequireFeature('googleSheets')
@Controller('google-sheets')
export class GoogleSheetsController {
  constructor(private readonly sheets: GoogleSheetsService) {}

  @Get('dashboard')
  dashboard(@Query('storeId') storeId: string) {
    return this.sheets.dashboard(storeId)
  }

  @Get('logs')
  logs(
    @Query('storeId') storeId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.sheets.logs(storeId, Number(page) || 1, Number(limit) || 30)
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
  ) {
    return this.sheets.sync(
      storeId,
      body.sheetType,
      body.resourceId,
      body.resourceType,
      body.triggeredBy,
    )
  }

  @Post('sync-all')
  syncAll(@Query('storeId') storeId: string, @Body() body: { triggeredBy?: string }) {
    return this.sheets.syncAll(storeId, body.triggeredBy)
  }

  @Post('retry-failed')
  retryFailed(@Query('storeId') storeId: string) {
    return this.sheets.retryFailed(storeId)
  }
}
