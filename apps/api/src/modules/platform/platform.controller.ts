import { Controller, Get, Query } from '@nestjs/common'
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
  getMedia(@Query('storeId') storeId: string) {
    return this.platform.getMedia(storeId)
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

  @Get('observability')
  getObservability(@Query('storeId') storeId: string) {
    return this.platform.getObservability(storeId)
  }

  @Get('integrations')
  getIntegrations(@Query('storeId') storeId: string) {
    return this.platform.getIntegrations(storeId)
  }

  @Get('system-logs')
  getSystemLogs(@Query('storeId') storeId: string, @Query('limit') limit?: string) {
    return this.platform.getSystemLogs(storeId, limit ? Number(limit) : 50)
  }

  @Get('telegram-logs')
  getTelegramLogs(@Query('storeId') storeId: string, @Query('limit') limit?: string) {
    return this.platform.getTelegramLogs(storeId, limit ? Number(limit) : 50)
  }
}
