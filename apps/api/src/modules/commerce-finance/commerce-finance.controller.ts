import { Controller, Get, Post, Patch, Inject, Query, Param, Body } from '@nestjs/common'
import type { RMAStatus, RMAType } from '@prisma/client'
import { CommerceFinanceService } from './commerce-finance.service'

@Controller('admin/commerce-finance')
export class CommerceFinanceController {
  constructor(@Inject(CommerceFinanceService) private readonly finance: CommerceFinanceService) {}

  @Get('invoices')
  listInvoices(@Query('storeId') storeId?: string, @Query('search') search?: string) {
    return this.finance.listInvoices(storeId, search)
  }

  @Get('transactions/health')
  transactionHealth(@Query('storeId') storeId?: string) {
    return this.finance.transactionHealth(storeId)
  }

  @Get('transactions/:id')
  getTransaction(@Query('storeId') storeId: string, @Param('id') id: string) {
    return this.finance.getTransaction(storeId, id)
  }

  @Get('transactions')
  listTransactions(@Query('storeId') storeId?: string, @Query('search') search?: string) {
    return this.finance.listTransactions(storeId, search)
  }

  @Get('returns')
  listReturns(@Query('storeId') storeId?: string, @Query('search') search?: string) {
    return this.finance.listReturns(storeId, search)
  }

  @Post('returns')
  createReturn(
    @Query('storeId') storeId: string,
    @Body()
    body: {
      orderId: string
      type?: RMAType
      reason: string
      description?: string
      customerId?: string
    },
  ) {
    return this.finance.createReturn(storeId, body)
  }

  @Patch('returns/:id/status')
  updateReturnStatus(
    @Query('storeId') storeId: string,
    @Param('id') id: string,
    @Body() body: { status: RMAStatus; note?: string; refundAmount?: number },
  ) {
    return this.finance.updateReturnStatus(storeId, id, body)
  }
}
