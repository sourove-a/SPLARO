import { Controller, Delete, Get, Header, Logger, NotFoundException, Patch, Param, Query, Body, Post, Inject, Req, StreamableFile } from '@nestjs/common'
import type { Request } from 'express'
import type { AdminSessionPayload } from '../../common/auth/admin-session.util'
import { PrismaService } from '../../common/prisma.service'
import { deleteOrderWithRelations } from '../../common/order-cleanup'
import { assertOrderStatusTransition, STOCK_RESTORING_STATUSES } from '../../common/order-status.util'
import { restoreOrderStock } from '../../common/order-stock.util'
import { StorefrontOrdersService } from '../storefront/storefront-orders.service'
import { ProfitLossService } from '../finance/profit-loss.service'
import { GoogleSheetsFinanceService } from '../finance/finance-support.service'
import { CourierService } from '../courier/courier.service'
import { InvoiceService } from '../invoices/invoice.service'
import { OrderEventsService } from './order-events.service'
import { AdminTelegramHubService } from '../notifications/admin-telegram-hub.service'
import { resolveStoreId } from '../../common/store.util'
import type { CourierProvider, OrderStatus, PaymentStatus, Prisma } from '@prisma/client'

type AdminRequest = Request & { adminUser?: AdminSessionPayload }

@Controller('admin/orders')
export class OrdersController {
  private readonly logger = new Logger(OrdersController.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly profitLoss: ProfitLossService,
    private readonly sheets: GoogleSheetsFinanceService,
    @Inject(CourierService) private readonly courier: CourierService,
    @Inject(StorefrontOrdersService) private readonly storefrontOrders: StorefrontOrdersService,
    @Inject(InvoiceService) private readonly invoices: InvoiceService,
    private readonly orderEvents: OrderEventsService,
    private readonly telegramHub: AdminTelegramHubService,
  ) {}

  /** Resolve an order by id/invoiceNumber, scoped to the caller's store — prevents cross-store IDOR. */
  private async ownedOrderId(idOrInvoice: string, req: AdminRequest): Promise<string> {
    const storeId = req.adminUser?.storeId
      ? await resolveStoreId(this.prisma, req.adminUser.storeId)
      : undefined
    const order = await this.prisma.order.findFirst({
      where: {
        OR: [{ id: idOrInvoice }, { invoiceNumber: idOrInvoice }],
        ...(storeId ? { storeId } : {}),
      },
      select: { id: true, storeId: true },
    })
    if (!order) throw new NotFoundException('Order not found')
    return order.id
  }

  @Get()
  async list(
    @Query('storeId') storeId: string,
    @Query('status') status?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('search') search?: string,
  ) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const skip = (Number(page) - 1) * Number(limit)
    const where: Prisma.OrderWhereInput = {
      storeId: sid,
      ...(status ? { status: status as OrderStatus } : {}),
      ...(search ? {
        OR: [
          { invoiceNumber: { contains: search, mode: 'insensitive' as const } },
          { shippingPhone: { contains: search } },
          { shippingName: { contains: search, mode: 'insensitive' as const } },
        ],
      } : {}),
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: {
          items: {
            include: {
              product: {
                select: {
                  name: true,
                  images: { where: { isDefault: true }, take: 1, select: { url: true } },
                },
              },
              variant: { select: { size: true, color: true, image: true } },
            },
          },
          courier: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
      }),
      this.prisma.order.count({ where }),
    ])

    return { orders, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) }
  }

  @Get(':id/invoice/pdf')
  async invoicePdf(@Param('id') id: string, @Req() req: AdminRequest): Promise<StreamableFile> {
    const orderId = await this.ownedOrderId(id, req)
    const order = await this.invoices.loadOrder(orderId)
    const buffer = await this.invoices.buildPdfBuffer(orderId)
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: `attachment; filename="${order.invoiceNumber}.pdf"`,
    })
  }

  @Get(':id/invoice/print')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async invoicePrint(@Param('id') id: string, @Req() req: AdminRequest) {
    const orderId = await this.ownedOrderId(id, req)
    return this.invoices.buildHtml(orderId, { showToolbar: true, autoPrint: true })
  }

  @Post(':id/invoice/email')
  async invoiceEmail(@Param('id') id: string, @Body() body: { email?: string }, @Req() req: AdminRequest) {
    const orderId = await this.ownedOrderId(id, req)
    return this.invoices.sendInvoiceEmail(orderId, body.email)
  }

  @Get(':id/invoice/whatsapp')
  async invoiceWhatsApp(@Param('id') id: string, @Req() req: AdminRequest) {
    const orderId = await this.ownedOrderId(id, req)
    const order = await this.invoices.loadOrder(orderId)
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL ?? 'https://splaro.co'
    return {
      supportUrl: this.invoices.buildWhatsAppShareUrl(order, siteUrl),
      customerUrl: this.invoices.buildCustomerWhatsAppUrl(order),
    }
  }

  @Get(':id/invoice')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async invoice(@Param('id') id: string, @Req() req: AdminRequest) {
    const orderId = await this.ownedOrderId(id, req)
    return this.invoices.buildHtml(orderId, { showToolbar: true, autoPrint: false })
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: AdminRequest) {
    const order = await this.prisma.order.findFirst({
      where: {
        OR: [{ id }, { invoiceNumber: id }],
        ...(req.adminUser?.storeId ? { storeId: req.adminUser.storeId } : {}),
      },
      include: {
        items: {
          include: {
            product: {
              include: { images: { where: { isDefault: true }, take: 1 } },
            },
            variant: true,
          },
        },
        courier: true,
        internalNotes: { orderBy: { createdAt: 'desc' } },
        customer: { select: { firstName: true, lastName: true, phone: true, loyaltyTier: true, codRiskScore: true } },
      },
    })
    if (!order) throw new NotFoundException('Order not found')
    return order
  }

  private async applyStatusChange(
    id: string,
    statusRaw: string,
    note: string | undefined,
    callerStoreId?: string,
  ) {
    const existing = await this.prisma.order.findUnique({
      where: { id },
      select: { id: true, storeId: true, status: true },
    })
    if (!existing) throw new NotFoundException('Order not found')
    if (callerStoreId && existing.storeId !== callerStoreId) {
      throw new NotFoundException('Order not found')
    }

    const status = assertOrderStatusTransition(existing.status, statusRaw)
    const shouldRestoreStock =
      STOCK_RESTORING_STATUSES.includes(status) &&
      !STOCK_RESTORING_STATUSES.includes(existing.status)

    const order = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id },
        data: {
          status,
          ...(status === 'CONFIRMED' ? { confirmedAt: new Date() } : {}),
          ...(status === 'DELIVERED' ? { deliveredAt: new Date() } : {}),
          ...(status === 'CANCELLED' ? { cancelledAt: new Date() } : {}),
        },
      })

      if (shouldRestoreStock) {
        await restoreOrderStock(tx, id, `Stock restored — order ${status.toLowerCase()}`)
      }

      await tx.orderStatusHistory.create({
        data: { orderId: id, status, note: note ?? `Status changed to ${status}` },
      })

      return updated
    })

    if (note) {
      await this.prisma.orderNote.create({
        data: { orderId: id, body: note, isPrivate: true },
      })
    }

    return order
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() body: { status: string; note?: string },
    @Req() req: AdminRequest,
  ) {
    const order = await this.applyStatusChange(id, body.status, body.note, req.adminUser?.storeId)

    if (order.status === 'DELIVERED') {
      await this.profitLoss.calculateOrderProfit(order.storeId, id)
      await this.sheets.queueSync(order.storeId, 'ORDERS', id, 'ORDER')
      await this.sheets.queueSync(order.storeId, 'PROFIT_LOSS', id, 'ORDER')
    }

    void this.orderEvents
      .onStatusChanged(order.storeId, id, order.status, body.note)
      .catch((err: unknown) => this.logger.error(`onStatusChanged failed for order ${id}: ${err instanceof Error ? err.message : err}`))

    return order
  }

  @Patch(':id/cod-risk')
  async setCodRisk(
    @Param('id') id: string,
    @Body() body: { isCodRisk: boolean; requireAdvancePayment?: boolean },
    @Req() req: AdminRequest,
  ) {
    const orderId = await this.ownedOrderId(id, req)
    return this.prisma.order.update({
      where: { id: orderId },
      data: { isCodRisk: body.isCodRisk, requireAdvancePayment: body.requireAdvancePayment },
    })
  }

  @Patch(':id/payment')
  async updatePayment(
    @Param('id') id: string,
    @Body() body: { paymentStatus: PaymentStatus },
    @Req() req: AdminRequest,
  ) {
    const order = await this.prisma.order.findFirst({
      where: {
        OR: [{ id }, { invoiceNumber: id }],
        ...(req.adminUser?.storeId ? { storeId: req.adminUser.storeId } : {}),
      },
      select: { id: true },
    })
    if (!order) throw new NotFoundException('Order not found')

    return this.prisma.order.update({
      where: { id: order.id },
      data: { paymentStatus: body.paymentStatus },
      select: {
        id: true,
        invoiceNumber: true,
        paymentStatus: true,
        total: true,
      },
    })
  }

  @Post('bulk/status')
  async bulkUpdateStatus(
    @Body() body: { orderIds: string[]; status: string; note?: string },
    @Req() req: AdminRequest,
  ) {
    const results = await Promise.all(
      body.orderIds.map(async (orderId) => {
        try {
          const order = await this.applyStatusChange(orderId, body.status, body.note, req.adminUser?.storeId)
          void this.orderEvents
            .onStatusChanged(order.storeId, orderId, order.status, body.note)
            .catch((err: unknown) =>
              this.logger.error(`onStatusChanged failed for order ${orderId}: ${err instanceof Error ? err.message : err}`),
            )
          return { orderId, success: true, invoiceNumber: order.invoiceNumber }
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Update failed'
          return { orderId, success: false, error: message }
        }
      }),
    )
    const updated = results.filter((r) => r.success).length
    const failed = results.filter((r) => !r.success)

    if (body.orderIds.length > 0 && updated > 0) {
      const firstOk = results.find((r) => r.success)
      if (firstOk) {
        const row = await this.prisma.order.findUnique({
          where: { id: firstOk.orderId },
          select: { storeId: true },
        })
        if (row) {
          void this.telegramHub
            .notifyBulkOperation(
              row.storeId,
              `Bulk status → ${body.status}`,
              { total: results.length, success: updated, failed: failed.length },
              failed.map((f) => ({ id: f.orderId, error: f.error ?? 'Unknown' })),
            )
            .catch((err: unknown) => this.logger.error(`notifyBulkOperation failed: ${err instanceof Error ? err.message : err}`))
        }
      }
    }

    return { results, updated, failed: results.length - updated }
  }

  @Post()
  async create(
    @Query('storeId') storeId: string,
    @Body()
    body: {
      customer: {
        name: string
        phone: string
        email?: string
        address: string
        city: string
        district?: string
        division?: string
      }
      items: Array<{
        productId: string
        variantId?: string
        quantity: number
        name: string
        price: number
        size?: string
        color?: string
      }>
      subtotal: number
      delivery: number
      discount?: number
      total: number
      paymentMethod: string
    },
  ) {
    const order = await this.storefrontOrders.create({
      storeId,
      customer: {
        name: body.customer.name,
        phone: body.customer.phone,
        email: body.customer.email ?? `${body.customer.phone}@splaro.local`,
        address: body.customer.address,
        city: body.customer.city,
        district: body.customer.district,
        division: body.customer.division,
      },
      items: body.items,
      subtotal: body.subtotal,
      delivery: body.delivery,
      discount: body.discount ?? 0,
      total: body.total,
      paymentMethod: body.paymentMethod,
    })

    void this.orderEvents
      .onOrderPlaced(order.storeId, order.id)
      .catch((err: unknown) => this.logger.error(`onOrderPlaced failed for order ${order.id}: ${err instanceof Error ? err.message : err}`))

    return order
  }

  @Post('bulk/courier')
  async bookCourierBulk(
    @Body() body: { orderIds: string[]; provider?: CourierProvider },
    @Req() req: AdminRequest,
  ) {
    const results = await Promise.all(
      body.orderIds.map(async (orderId) => {
        try {
          const ownedId = await this.ownedOrderId(orderId, req)
          const result = await this.courier.bookCourier(ownedId, body.provider)
          return { orderId, ...result }
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Booking failed'
          return { orderId, success: false, error: message }
        }
      }),
    )
    const booked = results.filter((r) => r.success).length
    return { results, booked, failed: results.length - booked }
  }

  @Post(':id/courier')
  async bookCourier(
    @Param('id') id: string,
    @Body() body: { provider?: CourierProvider },
    @Req() req: AdminRequest,
  ) {
    const ownedId = await this.ownedOrderId(id, req)
    const result = await this.courier.bookCourier(ownedId, body.provider)
    if (!result.success) {
      return { success: false, error: result.error ?? 'Courier booking failed' }
    }
    return {
      success: true,
      consignmentId: result.consignmentId,
      trackingCode: result.trackingCode,
      trackingUrl: result.trackingUrl,
    }
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: AdminRequest) {
    const existing = await this.prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        storeId: true,
        invoiceNumber: true,
        shippingName: true,
        total: true,
        status: true,
      },
    })
    if (!existing) throw new NotFoundException('Order not found')
    if (req.adminUser?.storeId && existing.storeId !== req.adminUser.storeId) {
      throw new NotFoundException('Order not found')
    }

    try {
      const deleted = await this.prisma.$transaction(async (tx) => {
        // Return items to inventory before wiping the order (no-op when a
        // prior cancel/refund already restored them).
        await restoreOrderStock(tx, id, `Stock restored — order ${existing.invoiceNumber} deleted`)
        return deleteOrderWithRelations(tx, id)
      })
      if (!deleted) throw new NotFoundException('Order not found')

      void this.telegramHub
        .notifyOrderDeleted(existing.storeId, existing)
        .catch((err: unknown) => this.logger.error(`notifyOrderDeleted failed for order ${id}: ${err instanceof Error ? err.message : err}`))
      return { success: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Delete failed'
      void this.telegramHub.notifyAdminError(existing.storeId, 'Order Delete Failed', message, {
        invoiceNumber: existing.invoiceNumber,
        orderId: id,
        area: 'Orders / Delete',
      })
      throw err
    }
  }
}
