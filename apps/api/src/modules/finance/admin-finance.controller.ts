import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common'
import { FinanceOverviewService } from './finance-overview.service'
import { ProfitLossService } from './profit-loss.service'

@Controller('admin/finance')
export class AdminFinanceController {
  constructor(
    private readonly overview: FinanceOverviewService,
    private readonly profitLoss: ProfitLossService,
  ) {}

  @Get('overview')
  getOverview(
    @Query('storeId') storeId: string,
    @Query('preset') preset?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.overview.getOverview(storeId, { preset, from, to })
  }

  @Get('orders')
  listOrders(
    @Query('storeId') storeId: string,
    @Query('preset') preset?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.overview.listOrderProfit(storeId, { preset, from, to, page, limit })
  }

  @Get('orders/:id')
  getOrder(@Query('storeId') storeId: string, @Param('id') id: string) {
    return this.overview.getOrderProfit(storeId, id)
  }

  @Get('settings')
  getSettings(@Query('storeId') storeId: string) {
    return this.profitLoss.getFinanceSettings(storeId)
  }

  @Patch('settings')
  updateSettings(
    @Query('storeId') storeId: string,
    @Body() body: { defaultPackagingCostPerOrder?: number; paymentFeePercent?: number },
  ) {
    return this.profitLoss.updateFinanceSettings(storeId, body)
  }
}
