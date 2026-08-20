import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common'
import { RequireFeature } from '../../common/auth/require-feature.decorator'
import { PlatformService } from './platform.service'

@Controller('admin/platform')
export class PlatformController {
  constructor(private readonly platform: PlatformService) {}

  @RequireFeature('saas')
  @Get('saas')
  getSaaS(@Query('storeId') storeId: string) {
    return this.platform.getSaaS(storeId)
  }

  @Get('security')
  getSecurity(@Query('storeId') storeId: string) {
    return this.platform.getSecurity(storeId)
  }

  @Get('media')
  getMedia(
    @Query('storeId') storeId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @Query('q') q?: string,
    @Query('type') type?: string,
    @Query('folder') folder?: string,
  ) {
    return this.platform.getMedia(storeId, {
      cursor,
      limit: limit ? Number(limit) : undefined,
      q,
      type,
      folder,
    })
  }

  @RequireFeature('vendor')
  @Get('marketplace')
  getMarketplace(@Query('storeId') storeId: string) {
    return this.platform.getMarketplace(storeId)
  }

  @Get('developer')
  getDeveloper(@Query('storeId') storeId: string) {
    return this.platform.getDeveloper(storeId)
  }

  @Post('api-keys')
  createApiKey(
    @Query('storeId') storeId: string,
    @Body() body: { name: string; scopes?: string[] },
  ) {
    return this.platform.createApiKey(storeId, body)
  }

  @Delete('api-keys/:id')
  revokeApiKey(@Query('storeId') storeId: string, @Param('id') id: string) {
    return this.platform.revokeApiKey(storeId, id)
  }

  @Get('observability')
  getObservability(@Query('storeId') storeId: string) {
    return this.platform.getObservability(storeId)
  }

  @Get('integrations')
  getIntegrations(@Query('storeId') storeId: string) {
    return this.platform.getIntegrations(storeId)
  }

  @Get('system-logs')
  getSystemLogs(
    @Query('storeId') storeId: string,
    @Query('limit') limit?: string,
    @Query('page') page?: string,
    @Query('q') q?: string,
    @Query('level') level?: string,
  ) {
    return this.platform.getSystemLogs(storeId, {
      limit: limit ? Number(limit) : undefined,
      page: page ? Number(page) : undefined,
      q,
      level,
    })
  }

  @Get('telegram-logs')
  getTelegramLogs(@Query('storeId') storeId: string, @Query('limit') limit?: string) {
    return this.platform.getTelegramLogs(storeId, limit ? Number(limit) : 50)
  }
}
