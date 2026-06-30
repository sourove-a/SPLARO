import { Controller, Delete, Get, Header, NotFoundException, Patch, Param, Query, Body, Post, Inject, StreamableFile } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'
import { deleteOrderWithRelations } from '../../common/order-cleanup'
import { StorefrontOrdersService } from '../storefront/storefront-orders.service'
import { ProfitLossService } from '../finance/profit-loss.service'
import { GoogleSheetsFinanceService } from '../finance/finance-support.service'
import { CourierService } from '../courier/courier.service'
import { InvoiceService } from '../invoices/invoice.service'
import { OrderEventsService } from './order-events.service'
import { AdminTelegramHubService } from '../notifications/admin-telegram-hub.service'
import { resolveStoreId } from '../../common/store.util'
import type { CourierProvider, OrderStatus, Prisma } from '@prisma/client'

@Controller('admin/orders')
export class OrdersController {
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
  async invoicePdf(@Param('id') id: string): Promise<StreamableFile> {
    const order = await this.invoices.loadOrder(id)
    const buffer = await this.invoices.buildPdfBuffer(id)
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: `attachment; filename="${order.invoiceNumber}.pdf"`,
    })
  }

  @Get(':id/invoice/print')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async invoicePrint(@Param('id') id: string) {
    return this.invoices.buildHtml(id, { showToolbar: true, autoPrint: true })
  }

  @Post(':id/invoice/email')
  async invoiceEmail(@Param('id') id: string, @Body() body: { email?: string }) {
    return this.invoices.sendInvoiceEmail(id, body.email)
  }

  @Get(':id/invoice/whatsapp')
  async invoiceWhatsApp(@Param('id') id: string) {
    const order = await this.invoices.loadOrder(id)
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL ?? 'https://www.splaro.com.bd'
    return {
      supportUrl: this.invoices.buildWhatsAppShareUrl(order, siteUrl),
      customerUrl: this.invoices.buildCustomerWhatsAppUrl(order),
    }
  }

  @Get(':id/invoice')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async invoice(@Param('id') id: string) {
    return this.invoices.buildHtml(id, { showToolbar: true, autoPrint: false })
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const order = await this.prisma.order.findFirst({
      where: { OR: [{ id }, { invoiceNumber: id }] },
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

  @Patch(':id/status')
  async updateStatus(@Param('id') id: string, @Body() body: { status: string; note?: string }) {
    const order = await this.prisma.order.update({
      where: { id },
      data: {
        status: body.status as never,
        ...(body.status === 'CONFIRMED' ? { confirmedAt: new Date() } : {}),
        ...(body.status === 'DELIVERED' ? { deliveredAt: new Date() } : {}),
        ...(body.status === 'CANCELLED' ? { cancelledAt: new Date() } : {}),
      },
    })

    if (body.note) {
      await this.prisma.orderNote.create({
        data: { orderId: id, body: body.note, isPrivate: true },
      })
    }

    if (body.status === 'DELIVERED') {
      await this.profitLoss.calculateOrderProfit(order.storeId, id)
      await this.sheets.queueSync(order.storeId, 'ORDERS', id, 'ORDER')
      await this.sheets.queueSync(order.storeId, 'PROFIT_LOSS', id, 'ORDER')
    }

    void this.orderEvents.onStatusChanged(order.storeId, id, body.status as OrderStatus, body.note)

    return order
  }

  @Patch(':id/cod-risk')
  async setCodRisk(@Param('id') id: string, @Body() body: { isCodRisk: boolean; requireAdvancePayment?: boolean }) {
    return this.prisma.order.update({
      where: { id },
      data: { isCodRisk: body.isCodRisk, requireAdvancePayment: body.requireAdvancePayment },
    })
  }

  @Post('bulk/status')
  async bulkUpdateStatus(@Body() body: { orderIds: string[]; status: string; note?: string }) {
    const results = await Promise.all(
      body.orderIds.map(async (orderId) => {
        try {
          const order = await this.prisma.order.update({
            where: { id: orderId },
            data: {
              status: body.status as never,
              ...(body.status === 'DELIVERED' ? { deliveredAt: new Date() } : {}),
              ...(body.status === 'CANCELLED' ? { cancelledAt: new Date() } : {}),
            },
          })
          if (body.note) {
            await this.prisma.orderNote.create({
              data: { orderId, body: body.note, isPrivate: true },
            })
          }
          void this.orderEvents.onStatusChanged(order.storeId, orderId, body.status as OrderStatus, body.note)
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
          void this.telegramHub.notifyBulkOperation(
            row.storeId,
            `Bulk status → ${body.status}`,
            { total: results.length, success: updated, failed: failed.length },
            failed.map((f) => ({ id: f.orderId, error: f.error ?? 'Unknown' })),
          )
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

    void this.orderEvents.onOrderPlaced(order.storeId, order.id)

    return order
  }

  @Post('bulk/courier')
  async bookCourierBulk(@Body() body: { orderIds: string[]; provider?: CourierProvider }) {
    const results = await Promise.all(
      body.orderIds.map(async (orderId) => {
        try {
          const result = await this.courier.bookCourier(orderId, body.provider)
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
  ) {
    const result = await this.courier.bookCourier(id, body.provider)
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
  async remove(@Param('id') id: string) {
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

    try {
      const deleted = await this.prisma.$transaction((tx) => deleteOrderWithRelations(tx, id))
      if (!deleted) throw new NotFoundException('Order not found')

      void this.telegramHub.notifyOrderDeleted(existing.storeId, existing)
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
