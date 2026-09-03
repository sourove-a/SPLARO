import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Query,
  Param,
  Req,
} from '@nestjs/common'
import { Public } from '../../common/auth/public.decorator'
import { FunnelService } from './funnel.service'
import {
  ResolveFunnelQueryDto,
  CreateFunnelStoreDto,
  UpdateFunnelStoreDto,
  CreateFunnelOrderDto,
} from './funnel.dto'
import type { Request } from 'express'
import type { AdminSessionPayload } from '../../common/auth/admin-session.util'

type AuthenticatedAdminRequest = Request & { adminUser?: AdminSessionPayload }

@Controller()
export class FunnelController {
  constructor(private readonly funnelService: FunnelService) {}

  /* ─── Public Funnel Storefront Endpoints ───────────────────────── */

  /** Resolve dynamic funnel universe by Host header (e.g. lifestyle.splaro.co) */
  @Public()
  @Get('funnel/resolve')
  async resolveFunnel(@Query() query: ResolveFunnelQueryDto) {
    return this.funnelService.resolveByHost(query.host, query.slug)
  }

  /** Express 1-page frictionless checkout order placement */
  @Public()
  @Post('funnel/orders')
  async createFunnelOrder(@Body() dto: CreateFunnelOrderDto) {
    return this.funnelService.createOrder(dto)
  }

  /* ─── Admin Management Endpoints ──────────────────────────────── */

  /** List all configured funnel universes and custom domains */
  @Get('admin/funnels')
  async listFunnels() {
    return this.funnelService.listFunnels()
  }

  /** List all orders placed through D2C Funnels */
  @Get('admin/funnels/orders')
  async listFunnelOrders() {
    return this.funnelService.listFunnelOrders()
  }

  /** Create and launch a new funnel domain universe */
  @Post('admin/funnels')
  async createFunnel(
    @Body() dto: CreateFunnelStoreDto,
    @Req() req: AuthenticatedAdminRequest,
  ) {
    const ownerId = req.adminUser?.userId || 'system'
    return this.funnelService.createFunnel(dto, ownerId)
  }

  /** Update an existing funnel domain universe or change theme */
  @Patch('admin/funnels/:id')
  async updateFunnel(
    @Param('id') id: string,
    @Body() dto: UpdateFunnelStoreDto,
  ) {
    return this.funnelService.updateFunnel(id, dto)
  }

  /** Deactivate/delete a funnel domain universe */
  @Delete('admin/funnels/:id')
  async deleteFunnel(@Param('id') id: string) {
    return this.funnelService.deleteFunnel(id)
  }

  /** Update status for a funnel order (e.g. CANCELLED, CONFIRMED, SHIPPED, DELIVERED) */
  @Patch('admin/funnels/orders/:id/status')
  async updateOrderStatus(
    @Param('id') id: string,
    @Body() body: { status: string; note?: string },
  ) {
    return this.funnelService.updateFunnelOrderStatus(id, body.status, body.note)
  }

  /** Delete a funnel order */
  @Delete('admin/funnels/orders/:id')
  async deleteOrder(@Param('id') id: string) {
    return this.funnelService.deleteFunnelOrder(id)
  }
}
