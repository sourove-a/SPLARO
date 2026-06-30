import {
  Body,
  Controller,
  Get,
  Header,
  Inject,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common'
import type { Response } from 'express'
import { ReportsService } from './reports.service'
import { PrismaService } from '../../common/prisma.service'
import { resolveStoreId } from '../../common/store.util'

@Controller('finance-reports')
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  @Get('dashboard')
  dashboard(@Query('storeId') storeId: string) {
    return this.reports.dashboard(storeId)
  }

  @Get('partner-hub')
  partnerHub(@Query('storeId') storeId: string) {
    return this.reports.partnerHub(storeId)
  }

  @Get('partner/:partnerId/export')
  exportPartner(@Query('storeId') storeId: string, @Param('partnerId') partnerId: string) {
    return this.reports.exportPartner(storeId, partnerId)
  }

  @Get('audit-logs')
  auditLogs(
    @Query('storeId') storeId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.reports.auditLogs(storeId, Number(page) || 1, Number(limit) || 30)
  }

  /* ─── Revenue reports ─────────────────────────────────────── */

  /** Daily revenue breakdown for a date range */
  @Get('revenue/daily')
  async revenueDaily(
    @Query('storeId') storeId: string,
    @Query('days') days?: string,
  ) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const d = Math.min(Number(days) || 30, 365)
    const since = new Date()
    since.setDate(since.getDate() - d)

    const orders = await this.prisma.order.findMany({
      where: { storeId: sid, createdAt: { gte: since }, status: { not: 'CANCELLED' } },
      select: { total: true, createdAt: true, paymentMethod: true },
      orderBy: { createdAt: 'asc' },
    })

    const byDay: Record<string, { date: string; revenue: number; orders: number }> = {}
    for (let i = d; i >= 0; i--) {
      const dt = new Date()
      dt.setDate(dt.getDate() - i)
      const key = dt.toISOString().slice(0, 10)
      byDay[key] = { date: key, revenue: 0, orders: 0 }
    }

    for (const o of orders) {
      const key = o.createdAt.toISOString().slice(0, 10)
      if (byDay[key]) {
        byDay[key].revenue += Number(o.total)
        byDay[key].orders += 1
      }
    }

    return Object.values(byDay)
  }

  /** Revenue by payment method */
  @Get('revenue/by-payment')
  async revenueByPayment(
    @Query('storeId') storeId: string,
    @Query('days') days?: string,
  ) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const since = new Date()
    since.setDate(since.getDate() - (Number(days) || 30))

    return this.prisma.order.groupBy({
      by: ['paymentMethod'],
      where: { storeId: sid, createdAt: { gte: since }, status: { not: 'CANCELLED' } },
      _sum: { total: true },
      _count: true,
      orderBy: { _sum: { total: 'desc' } },
    })
  }

  /** Revenue by district/region */
  @Get('revenue/by-district')
  async revenueByDistrict(
    @Query('storeId') storeId: string,
    @Query('days') days?: string,
  ) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const since = new Date()
    since.setDate(since.getDate() - (Number(days) || 30))

    return this.prisma.order.groupBy({
      by: ['shippingDistrict'],
      where: { storeId: sid, createdAt: { gte: since }, status: { not: 'CANCELLED' } },
      _sum: { total: true },
      _count: true,
      orderBy: { _sum: { total: 'desc' } },
      take: 20,
    })
  }

  /* ─── Order reports ───────────────────────────────────────── */

  /** Orders summary: totals by status */
  @Get('orders/summary')
  async ordersSummary(
    @Query('storeId') storeId: string,
    @Query('days') days?: string,
  ) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const since = new Date()
    since.setDate(since.getDate() - (Number(days) || 30))

    const [byStatus, totals] = await Promise.all([
      this.prisma.order.groupBy({
        by: ['status'],
        where: { storeId: sid, createdAt: { gte: since } },
        _count: true,
        _sum: { total: true },
      }),
      this.prisma.order.aggregate({
        where: { storeId: sid, createdAt: { gte: since } },
        _count: { id: true },
        _sum: { total: true },
        _avg: { total: true },
      }),
    ])

    return {
      byStatus,
      totalOrders: totals._count.id,
      totalRevenue: Number(totals._sum.total ?? 0),
      averageOrderValue: Number(totals._avg.total ?? 0),
    }
  }

  /** Export orders to CSV */
  @Get('orders/export-csv')
  @Header('Content-Type', 'text/csv')
  async exportOrdersCsv(
    @Query('storeId') storeId: string,
    @Query('days') days?: string,
    @Res() res?: Response,
  ) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const since = new Date()
    since.setDate(since.getDate() - (Number(days) || 30))

    const orders = await this.prisma.order.findMany({
      where: { storeId: sid, createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      select: {
        invoiceNumber: true,
        shippingName: true,
        shippingPhone: true,
        shippingDistrict: true,
        total: true,
        status: true,
        paymentMethod: true,
        paymentStatus: true,
        createdAt: true,
      },
      take: 5000,
    })

    const header = 'Invoice,Name,Phone,District,Total,Status,Payment Method,Payment Status,Date'
    const rows = orders.map((o) =>
      [
        o.invoiceNumber ?? '',
        o.shippingName ?? '',
        o.shippingPhone ?? '',
        o.shippingDistrict ?? '',
        Number(o.total),
        o.status,
        o.paymentMethod ?? '',
        o.paymentStatus,
        o.createdAt.toISOString(),
      ].join(','),
    )

    const csv = [header, ...rows].join('\n')
    if (res) {
      res.set('Content-Disposition', `attachment; filename="orders-${sid}-${new Date().toISOString().slice(0, 10)}.csv"`)
      res.end(csv)
    }
    return csv
  }

  /* ─── Product reports ─────────────────────────────────────── */

  /** Top selling products */
  @Get('products/top-selling')
  async topSellingProducts(
    @Query('storeId') storeId: string,
    @Query('days') days?: string,
    @Query('limit') limit?: string,
  ) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const since = new Date()
    since.setDate(since.getDate() - (Number(days) || 30))

    return this.prisma.orderItem.groupBy({
      by: ['productId', 'productName'],
      where: { order: { storeId: sid, createdAt: { gte: since }, status: { not: 'CANCELLED' } } },
      _sum: { quantity: true, subtotal: true },
      _count: true,
      orderBy: { _sum: { subtotal: 'desc' } },
      take: Math.min(Number(limit) || 20, 100),
    })
  }

  /** Slow-moving / zero-sales products */
  @Get('products/slow-moving')
  async slowMovingProducts(@Query('storeId') storeId: string, @Query('days') days?: string) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const since = new Date()
    since.setDate(since.getDate() - (Number(days) || 30))

    const soldIds = await this.prisma.orderItem.findMany({
      where: { order: { storeId: sid, createdAt: { gte: since } } },
      select: { productId: true },
      distinct: ['productId'],
    })
    const soldSet = new Set(soldIds.map((s) => s.productId))

    const allProducts = await this.prisma.product.findMany({
      where: { storeId: sid, status: { not: 'ARCHIVED' } },
      select: { id: true, name: true, slug: true, createdAt: true },
    })

    return allProducts.filter((p) => !soldSet.has(p.id))
  }

  /* ─── Customer reports ────────────────────────────────────── */

  /** New customers over time */
  @Get('customers/growth')
  async customerGrowth(@Query('storeId') storeId: string, @Query('days') days?: string) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const d = Math.min(Number(days) || 30, 365)
    const since = new Date()
    since.setDate(since.getDate() - d)

    const customers = await this.prisma.customer.findMany({
      where: { storeId: sid, createdAt: { gte: since } },
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    })

    const byDay: Record<string, number> = {}
    for (let i = d; i >= 0; i--) {
      const dt = new Date()
      dt.setDate(dt.getDate() - i)
      byDay[dt.toISOString().slice(0, 10)] = 0
    }

    for (const c of customers) {
      const key = c.createdAt.toISOString().slice(0, 10)
      if (byDay[key] !== undefined) byDay[key]++
    }

    return Object.entries(byDay).map(([date, count]) => ({ date, newCustomers: count }))
  }

  /** Top customers by spend */
  @Get('customers/top-spenders')
  async topSpenders(
    @Query('storeId') storeId: string,
    @Query('limit') limit?: string,
    @Query('days') days?: string,
  ) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const since = new Date()
    since.setDate(since.getDate() - (Number(days) || 90))

    return this.prisma.order.groupBy({
      by: ['customerId'],
      where: { storeId: sid, createdAt: { gte: since }, status: { not: 'CANCELLED' }, customerId: { not: null } },
      _sum: { total: true },
      _count: true,
      orderBy: { _sum: { total: 'desc' } },
      take: Math.min(Number(limit) || 20, 100),
    })
  }

  /* ─── Inventory reports ───────────────────────────────────── */

  /** Inventory valuation */
  @Get('inventory/valuation')
  async inventoryValuation(@Query('storeId') storeId: string) {
    const sid = await resolveStoreId(this.prisma, storeId)

    const variants = await this.prisma.productVariant.findMany({
      where: { product: { storeId: sid, status: { not: 'ARCHIVED' } } },
      select: { stock: true, price: true, product: { select: { costPrice: true } } },
    })

    let retailValue = 0
    let costValue = 0
    let totalUnits = 0

    for (const v of variants) {
      const stock = v.stock ?? 0
      retailValue += stock * Number(v.price ?? 0)
      costValue += stock * Number(v.product?.costPrice ?? 0)
      totalUnits += stock
    }

    return {
      totalUnits,
      retailValue,
      costValue,
      potentialProfit: retailValue - costValue,
      variantCount: variants.length,
    }
  }

  /** Stock movement log */
  @Get('inventory/movements')
  async inventoryMovements(
    @Query('storeId') storeId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('type') type?: string,
  ) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const take = Math.min(Number(limit) || 50, 200)
    const skip = (Math.max(Number(page) || 1, 1) - 1) * take

    const where = {
      product: { storeId: sid },
      ...(type ? { action: type as 'PURCHASE' | 'SALE' | 'RETURN' | 'ADJUSTMENT' | 'TRANSFER' | 'DAMAGE' | 'INITIAL' } : {}),
    }

    const [items, total] = await Promise.all([
      this.prisma.inventoryLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          variant: { select: { sku: true } },
          product: { select: { name: true } },
        },
      }),
      this.prisma.inventoryLog.count({ where }),
    ])

    return { items, total, page: Number(page) || 1, limit: take }
  }

  /* ─── Full report export ──────────────────────────────────── */

  /** Generate comprehensive store report */
  @Post('generate')
  async generateReport(
    @Body()
    body: {
      storeId: string
      type: 'revenue' | 'orders' | 'customers' | 'inventory' | 'full'
      days?: number
    },
  ) {
    const sid = await resolveStoreId(this.prisma, body.storeId)
    const d = body.days ?? 30
    const since = new Date()
    since.setDate(since.getDate() - d)

    const [orderStats, customerStats, inventoryAlerts] = await Promise.all([
      this.prisma.order.aggregate({
        where: { storeId: sid, createdAt: { gte: since }, status: { not: 'CANCELLED' } },
        _count: { id: true },
        _sum: { total: true },
        _avg: { total: true },
      }),
      this.prisma.customer.aggregate({
        where: { storeId: sid, createdAt: { gte: since } },
        _count: { id: true },
      }),
      Promise.all([
        this.prisma.productVariant.count({
          where: { product: { storeId: sid, status: { not: 'ARCHIVED' } }, stock: 0 },
        }),
        this.prisma.productVariant.count({
          where: { product: { storeId: sid, status: { not: 'ARCHIVED' } }, stock: { gt: 0, lte: 5 } },
        }),
      ]),
    ])

    return {
      generatedAt: new Date().toISOString(),
      period: `${d}d`,
      storeId: sid,
      type: body.type,
      summary: {
        orders: orderStats._count.id,
        revenue: Number(orderStats._sum.total ?? 0),
        aov: Number(orderStats._avg.total ?? 0),
        newCustomers: customerStats._count.id,
        outOfStock: inventoryAlerts[0],
        lowStock: inventoryAlerts[1],
      },
    }
  }
}
