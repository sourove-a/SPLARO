import { Body, Controller, Get, Patch, Post, Query } from '@nestjs/common'
import { AdminHubService } from './admin-hub.service'
import type { SupportTicketChannel, TaskPriority } from '@prisma/client'

@Controller('admin/hub')
export class AdminHubController {
  constructor(private readonly hub: AdminHubService) {}

  @Get('content/overview')
  contentOverview(@Query('storeId') storeId: string) {
    return this.hub.contentOverview(storeId)
  }

  @Post('content/blog')
  createBlog(
    @Query('storeId') storeId: string,
    @Body() body: { title: string; content?: string; excerpt?: string; status?: 'DRAFT' | 'PUBLISHED' },
  ) {
    return this.hub.createBlogPost(storeId, body)
  }

  @Get('seo/overview')
  seoOverview(@Query('storeId') storeId: string) {
    return this.hub.seoOverview(storeId)
  }

  @Get('marketing/overview')
  marketingOverview(@Query('storeId') storeId: string) {
    return this.hub.marketingOverview(storeId)
  }

  @Patch('marketing/social-channels')
  updateSocialChannels(
    @Query('storeId') storeId: string,
    @Body()
    body: {
      instagram?: string
      facebook?: string
      tiktok?: string
      youtube?: string
      whatsapp?: string
    },
  ) {
    return this.hub.updateSocialChannels(storeId, body)
  }

  @Post('marketing/affiliates')
  createAffiliate(
    @Query('storeId') storeId: string,
    @Body() body: { name: string; email?: string; code: string; commissionRate?: number },
  ) {
    return this.hub.createAffiliate(storeId, body)
  }

  @Post('procurement/suppliers')
  createSupplier(
    @Query('storeId') storeId: string,
    @Body() body: { name: string; phone?: string; email?: string; address?: string },
  ) {
    return this.hub.createSupplier(storeId, body)
  }

  @Post('procurement/purchase-orders')
  createPurchaseOrder(
    @Query('storeId') storeId: string,
    @Body()
    body: {
      supplierId: string
      notes?: string
      items: { productName: string; sku?: string; quantity: number; unitCost: number }[]
    },
  ) {
    return this.hub.createPurchaseOrder(storeId, body)
  }

  @Post('support/tickets')
  createTicket(
    @Query('storeId') storeId: string,
    @Body()
    body: {
      subject: string
      channel?: SupportTicketChannel
      priority?: TaskPriority
      message?: string
    },
  ) {
    return this.hub.createSupportTicket(storeId, body)
  }

  @Get('notifications/overview')
  notificationsOverview(@Query('storeId') storeId: string) {
    return this.hub.notificationsOverview(storeId)
  }

  @Get('commerce/subscriptions')
  commerceSubscriptions(@Query('storeId') storeId: string) {
    return this.hub.commerceSubscriptionsOverview(storeId)
  }
}
