import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Inject,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common'
import type { Request } from 'express'
import type { AdminSessionPayload } from '../../common/auth/admin-session.util'
import { FulfillmentService } from './fulfillment.service'

type AdminRequest = Request & { adminUser?: AdminSessionPayload }

@Controller('admin')
export class FulfillmentController {
  constructor(@Inject(FulfillmentService) private readonly fulfillment: FulfillmentService) {}

  /** 4×6 thermal shipping label */
  @Get('orders/:id/label')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async shippingLabel(
    @Param('id') id: string,
    @Query('print') print: string | undefined,
    @Req() req: AdminRequest,
  ) {
    const autoPrint = print !== '0' && print !== 'false'
    return this.fulfillment.buildShippingLabelHtml(id, {
      autoPrint,
      storeId: req.adminUser?.storeId,
    })
  }

  /** Small product stickers (one per line item) */
  @Get('orders/:id/label/sticker')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async productStickers(
    @Param('id') id: string,
    @Query('print') print: string | undefined,
    @Req() req: AdminRequest,
  ) {
    const autoPrint = print !== '0' && print !== 'false'
    return this.fulfillment.buildProductStickersHtml(id, {
      autoPrint,
      storeId: req.adminUser?.storeId,
    })
  }

  /** Bulk 4×6 labels — body: { orderIds: string[] } */
  @Post('orders/labels/bulk')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async bulkLabels(
    @Body() body: { orderIds?: string[]; print?: boolean },
    @Req() req: AdminRequest,
  ) {
    const ids = body?.orderIds
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new BadRequestException('orderIds array is required')
    }
    return this.fulfillment.buildBulkShippingLabelsHtml(ids, {
      autoPrint: body.print !== false,
      storeId: req.adminUser?.storeId,
    })
  }

  /** Scan barcode / tracking → pack or dispatch */
  @Post('fulfillment/scan')
  async scan(
    @Body() body: { code?: string; action?: 'pack' | 'dispatch' },
    @Req() req: AdminRequest,
  ) {
    const code = body?.code?.trim()
    const action = body?.action
    if (!code) throw new BadRequestException('code is required')
    if (action !== 'pack' && action !== 'dispatch') {
      throw new BadRequestException('action must be pack or dispatch')
    }
    return this.fulfillment.scan(code, action, req.adminUser?.storeId)
  }

  /** Today's packing station counters */
  @Get('fulfillment/stats/today')
  async todayStats(@Req() req: AdminRequest) {
    return this.fulfillment.todayCounts(req.adminUser?.storeId)
  }
}
