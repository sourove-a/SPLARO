import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common'
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

  @Get('procurement/summary')
  procurementSummary(@Query('storeId') storeId: string) {
    return this.hub.procurementSummary(storeId)
  }

  @Get('procurement/markets')
  listMarkets(@Query('storeId') storeId: string) {
    return this.hub.listSupplierMarkets(storeId)
  }

  @Post('procurement/markets')
  createMarket(
    @Query('storeId') storeId: string,
    @Body() body: { name: string; area?: string; city?: string; country?: string; note?: string },
  ) {
    return this.hub.createSupplierMarket(storeId, body)
  }

  @Patch('procurement/markets/:id')
  updateMarket(
    @Query('storeId') storeId: string,
    @Param('id') id: string,
    @Body()
    body: {
      name?: string
      area?: string
      city?: string
      country?: string
      note?: string
      isActive?: boolean
    },
  ) {
    return this.hub.updateSupplierMarket(storeId, id, body)
  }

  @Get('procurement/suppliers')
  listSuppliers(
    @Query('storeId') storeId: string,
    @Query('search') search?: string,
    @Query('marketId') marketId?: string,
  ) {
    return this.hub.listSuppliers(storeId, { search, marketId })
  }

  @Get('procurement/suppliers/:id')
  getSupplier(@Query('storeId') storeId: string, @Param('id') id: string) {
    return this.hub.getSupplier(storeId, id)
  }

  @Post('procurement/suppliers')
  createSupplier(
    @Query('storeId') storeId: string,
    @Body()
    body: {
      name: string
      phone?: string
      altPhone?: string
      whatsapp?: string
      email?: string
      shopName?: string
      address?: string
      note?: string
      marketId?: string
      leadTimeDays?: number | null
      categoryIds?: string[]
    },
  ) {
    return this.hub.createSupplier(storeId, body)
  }

  @Patch('procurement/suppliers/:id')
  updateSupplier(
    @Query('storeId') storeId: string,
    @Param('id') id: string,
    @Body()
    body: {
      name?: string
      phone?: string
      altPhone?: string
      whatsapp?: string
      email?: string
      shopName?: string
      address?: string
      note?: string
      marketId?: string | null
      leadTimeDays?: number | null
      categoryIds?: string[]
      isActive?: boolean
    },
  ) {
    return this.hub.updateSupplier(storeId, id, body)
  }

  /**
   * Only for a supplier added by mistake — the service refuses one that already
   * carries purchase orders or payments.
   */
  @Delete('procurement/suppliers/:id')
  deleteSupplier(@Query('storeId') storeId: string, @Param('id') id: string) {
    return this.hub.deleteSupplier(storeId, id)
  }

  @Post('procurement/purchase-orders')
  createPurchaseOrder(
    @Query('storeId') storeId: string,
    @Body()
    body: {
      supplierId: string
      marketId?: string
      purchasedAt?: string
      expectedAt?: string | null
      emailSupplier?: boolean
      notes?: string
      discount?: number
      transportCost?: number
      otherCost?: number
      paidAmount?: number
      paymentMethod?: string
      items: {
        productId?: string
        variantId?: string
        productName?: string
        sku?: string
        quantity: number
        unitCost: number
      }[]
    },
  ) {
    return this.hub.createPurchaseOrder(storeId, body)
  }

  /** Move the expected delivery date. Null or empty clears it. */
  @Patch('procurement/purchase-orders/:id/eta')
  updatePurchaseOrderEta(
    @Query('storeId') storeId: string,
    @Param('id') id: string,
    @Body() body: { expectedAt?: string | null },
  ) {
    return this.hub.updatePurchaseOrderEta(storeId, id, body)
  }

  /**
   * Delete a purchase order raised by mistake. The service reverses the stock
   * it added, the payments booked against it, and the supplier balance.
   */
  @Delete('procurement/purchase-orders/:id')
  deletePurchaseOrder(
    @Query('storeId') storeId: string,
    @Param('id') id: string,
    @Query('deletedBy') deletedBy?: string,
    @Query('emailSupplier') emailSupplier?: string,
  ) {
    return this.hub.deletePurchaseOrder(storeId, id, {
      ...(deletedBy ? { deletedBy } : {}),
      ...(emailSupplier === 'false' ? { emailSupplier: false } : {}),
    })
  }

  @Post('procurement/goods-received')
  receiveGoodsGrn(
    @Query('storeId') storeId: string,
    @Body()
    body: {
      purchaseOrderId?: string
      notes?: string
      receivedBy?: string
      emailSupplier?: boolean
    },
  ) {
    return this.hub.receiveGoodsGrn(storeId, body)
  }

  /** Resend a supplier their copy of an order — after an address is added, say. */
  @Post('procurement/purchase-orders/:id/email')
  emailPurchaseOrder(@Query('storeId') storeId: string, @Param('id') id: string) {
    return this.hub.emailPurchaseOrderToSupplier(storeId, id)
  }

  @Post('procurement/supplier-payments')
  recordSupplierPayment(
    @Query('storeId') storeId: string,
    @Body()
    body: {
      supplierId: string
      purchaseOrderId?: string
      amount: number
      method?: string
      reference?: string
      note?: string
      paidAt?: string
      createdBy?: string
      emailSupplier?: boolean
    },
  ) {
    return this.hub.recordSupplierPayment(storeId, body)
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
