import { Controller, Get, Patch, Body, UseGuards, Query, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/auth.decorator';
import { CatalogService } from '../catalog/catalog.service';
import { OrderService } from '../order/order.service';
import { AnalyticsService } from '../analytics/analytics.service';

@ApiTags('Admin Governance')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
@ApiBearerAuth()
export class AdminController {
  constructor(
    private catalog: CatalogService,
    private orders: OrderService,
    private analytics: AnalyticsService
  ) {}

  @Get('dashboard/insights')
  @ApiOperation({ summary: 'Get institutional performance metrics' })
  async getInsights() {
    return this.analytics.getDashboardSummary();
  }

  @Patch('catalog/product/:id')
  @ApiOperation({ summary: 'Update product properties (e.g. Price, Status, Drops)' })
  async updateProduct(@Query('id') id: string, @Body() data: any) {
    // Admin directly modifies the product archive
    return this.catalog.updateProduct(id, data);
  }

  @Get('orders/management')
  @ApiOperation({ summary: 'Full order monitoring and manual state override' })
  async listOrders(@Query() filters: any) {
    return this.orders.findAll(filters);
  }

  @Patch('orders/:id/status')
  @ApiOperation({ summary: 'Manual order status transition' })
  async updateOrderStatus(@Query('id') id: string, @Body('status') status: string) {
    return this.orders.updateStatus(id, status);
  }

  @Delete('cache/clear')
  @ApiOperation({ summary: 'Manual cache purge (Redis) for instant updates' })
  async purgeCache() {
    // Trigger global redis purge
  }
}
