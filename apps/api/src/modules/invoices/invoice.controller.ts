import { Controller, Get, Header, Inject, Param, Post, Query, Res } from '@nestjs/common'
import type { Response } from 'express'
import { isFeatureEnabled } from '@splaro/config'
import { InvoiceService } from './invoice.service'
import { PrismaService } from '../../common/prisma.service'
import { resolveStoreId } from '../../common/store.util'

@Controller('admin/invoices')
export class InvoiceController {
  constructor(
    @Inject(InvoiceService) private readonly invoices: InvoiceService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  /** List invoices for a store (orders that have an invoiceNumber) */
  @Get()
  async list(
    @Query('storeId') storeId: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const take = Math.min(Number(limit) || 30, 100)
    const skip = (Math.max(Number(page) || 1, 1) - 1) * take

    const where = {
      storeId: sid,
      ...(search
        ? {
            OR: [
              { invoiceNumber: { contains: search, mode: 'insensitive' as const } },
              { shippingName: { contains: search, mode: 'insensitive' as const } },
              { shippingPhone: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    }

    const [items, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          invoiceNumber: true,
          shippingName: true,
          shippingPhone: true,
          total: true,
          status: true,
          paymentMethod: true,
          createdAt: true,
        },
      }),
      this.prisma.order.count({ where }),
    ])

    return { items, total, page: Number(page) || 1, limit: take }
  }

  /** Lightweight health for admin API Health probes */
  @Get('health')
  async health(@Query('storeId') storeId: string) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const [orderCount, latest] = await Promise.all([
      this.prisma.order.count({ where: { storeId: sid } }),
      this.prisma.order.findFirst({
        where: { storeId: sid },
        orderBy: { createdAt: 'desc' },
        select: { invoiceNumber: true },
      }),
    ])
    return {
      status: 'ok',
      orderCount,
      latestInvoice: latest?.invoiceNumber ?? null,
      pdfRoute: '/admin/invoices/:orderId/pdf',
    }
  }

  /** Invoice summary stats */
  @Get('stats/overview')
  async stats(@Query('storeId') storeId: string, @Query('days') days?: string) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const since = new Date()
    since.setDate(since.getDate() - (Number(days) || 30))

    const [total, byPayment, revenueSum] = await Promise.all([
      this.prisma.order.count({
        where: { storeId: sid, createdAt: { gte: since } },
      }),
      this.prisma.order.groupBy({
        by: ['paymentMethod'],
        where: { storeId: sid, createdAt: { gte: since } },
        _count: true,
        _sum: { total: true },
      }),
      this.prisma.order.aggregate({
        where: { storeId: sid, createdAt: { gte: since } },
        _sum: { total: true },
      }),
    ])

    return {
      totalInvoices: total,
      totalRevenue: revenueSum._sum?.total ?? 0,
      byPaymentMethod: byPayment,
      period: `${Number(days) || 30}d`,
    }
  }

  /** Render invoice as HTML */
  @Get(':orderId/html')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async html(
    @Param('orderId') orderId: string,
    @Query('autoPrint') autoPrint?: string,
  ) {
    return this.invoices.buildHtml(orderId, {
      showToolbar: true,
      autoPrint:
        isFeatureEnabled('printAuto') && (autoPrint === '1' || autoPrint === 'true'),
    })
  }

  /** Download invoice as PDF */
  @Get(':orderId/pdf')
  async pdf(
    @Param('orderId') orderId: string,
    @Res() res: Response,
  ) {
    const order = await this.invoices.loadOrder(orderId)
    const buf = await this.invoices.buildPdfBuffer(orderId)
    const filename = `invoice-${order.invoiceNumber ?? orderId}.pdf`
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buf.length,
    })
    res.end(buf)
  }

  /** Send invoice email to customer */
  @Post(':orderId/send-email')
  async sendEmail(
    @Param('orderId') orderId: string,
    @Query('to') to?: string,
  ) {
    return this.invoices.sendInvoiceEmail(orderId, to)
  }

}
