import { Controller, Get, Post, Patch, Param, Query, Body } from '@nestjs/common'
import { ExpensesService } from './expenses.service'
import { ProfitLossService } from './profit-loss.service'
import {
  DailyClosingService,
} from './finance-support.service'

@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expenses: ExpensesService) {}

  @Get()
  list(
    @Query('storeId') storeId: string,
    @Query('category') category?: string,
    @Query('status') status?: string,
    @Query('partnerId') partnerId?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.expenses.list(storeId, {
      category: category as never,
      status: status as never,
      partnerId,
      page: Number(page) || 1,
      limit: Number(limit) || 20,
    })
  }

  @Post()
  create(
    @Query('storeId') storeId: string,
    @Body()
    body: {
      category: string
      amount: number
      expenseDate?: string
      note?: string
      attachmentUrl?: string
      partnerId?: string
      createdBy?: string
    },
  ) {
    return this.expenses.create(storeId, { ...body, category: body.category as never })
  }

  @Patch(':id/approve')
  approve(
    @Param('id') id: string,
    @Query('storeId') storeId: string,
    @Body() body: { approvedBy?: string },
  ) {
    return this.expenses.approve(id, storeId, body.approvedBy)
  }
}

@Controller('profit-loss')
export class ProfitLossController {
  constructor(private readonly profitLoss: ProfitLossService) {}

  @Get('daily')
  daily(@Query('storeId') storeId: string) {
    return this.profitLoss.getDailyProfit(storeId)
  }

  @Get('weekly')
  weekly(@Query('storeId') storeId: string) {
    return this.profitLoss.getWeeklyProfit(storeId)
  }

  @Get('monthly')
  monthly(@Query('storeId') storeId: string) {
    return this.profitLoss.getMonthlyProfit(storeId)
  }

  @Get('yearly')
  yearly(@Query('storeId') storeId: string) {
    return this.profitLoss.getYearlyProfit(storeId)
  }

  @Post('calculate/:orderId')
  calculateOrder(@Query('storeId') storeId: string, @Param('orderId') orderId: string) {
    return this.profitLoss.calculateOrderProfit(storeId, orderId)
  }
}

@Controller('daily-closing')
export class DailyClosingController {
  constructor(private readonly dailyClosing: DailyClosingService) {}

  @Get()
  list(
    @Query('storeId') storeId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.dailyClosing.list(storeId, Number(page) || 1, Number(limit) || 20)
  }

  @Post('run')
  run(
    @Query('storeId') storeId: string,
    @Body() body: { date?: string; closedBy?: string },
  ) {
    return this.dailyClosing.runClosing(
      storeId,
      body.date ? new Date(body.date) : new Date(),
      body.closedBy,
    )
  }

  @Patch(':id/approve')
  approve(
    @Param('id') id: string,
    @Query('storeId') storeId: string,
    @Body() body: { approvedBy?: string },
  ) {
    return this.dailyClosing.approve(id, storeId, body.approvedBy)
  }
}
