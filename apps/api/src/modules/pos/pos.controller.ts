import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { PosService, type CreatePosSaleInput } from './pos.service'

@Controller('admin/pos')
export class PosController {
  constructor(private readonly pos: PosService) {}

  @Get('catalog')
  catalog(
    @Query('storeId') storeId: string,
    @Query('q') q?: string,
    @Query('sku') sku?: string,
  ) {
    return this.pos.searchCatalog(storeId, q, sku)
  }

  @Get('today')
  today(@Query('storeId') storeId: string) {
    return this.pos.getTodayStats(storeId)
  }

  @Post('sale')
  sale(@Query('storeId') storeId: string, @Body() body: Omit<CreatePosSaleInput, 'storeId'>) {
    return this.pos.createSale({ ...body, storeId })
  }
}
