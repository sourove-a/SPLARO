import { Controller, Get, Inject, Query } from '@nestjs/common'
import { DashboardService } from './dashboard.service'
import { PrismaService } from '../../common/prisma.service'
import { resolveStoreId } from '../../common/store.util'
import type { DashboardInsightsResponse, DashboardStatsResponse } from './dashboard.types'

@Controller('admin/dashboard')
export class DashboardController {
  constructor(
    @Inject(DashboardService) private readonly dashboard: DashboardService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  @Get('stats')
  getStats(
    @Query('storeId') storeId?: string,
    @Query('period') period?: string,
  ): Promise<DashboardStatsResponse> {
    return this.dashboard.getStats(storeId, period)
  }

  @Get('insights')
  getInsights(
    @Query('storeId') storeId?: string,
    @Query('period') period?: string,
  ): Promise<DashboardInsightsResponse> {
    return this.dashboard.getInsights(storeId, period)
  }

  /** Recent orders feed — live ticker */
  @Get('recent-orders')
  async recentOrders(
    @Query('storeId') storeId: string,
    @Query('limit') limit?: string,
  ) {
    const sid = await resolveStoreId(this.prisma, storeId)
    return this.prisma.order.findMany({
      where: { storeId: sid },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Number(limit) || 10, 50),
      select: {
        id: true,
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
    })
  }

  /** KPI summary: revenue, orders, customers, AOV for a time window */
  @Get('kpi')
  async kpi(
    @Query('storeId') storeId: string,
    @Query('days') days?: string,
  ) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const d = Number(days) || 30
    const since = new Date()
    since.setDate(since.getDate() - d)
    const prevStart = new Date(since)
    prevStart.setDate(prevStart.getDate() - d)

    const range = { gte: since }
    const prevRange = { gte: prevStart, lt: since }

    const [curr, prev, customerCount, prevCustomerCount] = await Promise.all([
      this.prisma.order.aggregate({
        where: { storeId: sid, createdAt: range },
        _sum: { total: true },
        _count: { id: true },
        _avg: { total: true },
      }),
      this.prisma.order.aggregate({
        where: { storeId: sid, createdAt: prevRange },
        _sum: { total: true },
        _count: { id: true },
      }),
      this.prisma.customer.count({ where: { storeId: sid, createdAt: range } }),
      this.prisma.customer.count({ where: { storeId: sid, createdAt: prevRange } }),
    ])

    const pct = (a: number, b: number) => (b === 0 ? null : Math.round(((a - b) / b) * 100))
    const revenue = Number(curr._sum.total ?? 0)
    const prevRevenue = Number(prev._sum.total ?? 0)

    return {
      period: `${d}d`,
      revenue: { value: revenue, change: pct(revenue, prevRevenue) },
      orders: { value: curr._count.id, change: pct(curr._count.id, prev._count.id) },
      aov: { value: Number(curr._avg.total ?? 0), change: null },
      newCustomers: { value: customerCount, change: pct(customerCount, prevCustomerCount) },
    }
  }

  /** Top selling products in a period */
  @Get('top-products')
  async topProducts(
    @Query('storeId') storeId: string,
    @Query('limit') limit?: string,
    @Query('days') days?: string,
  ) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const since = new Date()
    since.setDate(since.getDate() - (Number(days) || 30))

    const grouped = await this.prisma.orderItem.groupBy({
      by: ['productId', 'productName'],
      where: { order: { storeId: sid, createdAt: { gte: since } } },
      _sum: { quantity: true, subtotal: true },
      orderBy: { _sum: { subtotal: 'desc' } },
      take: Math.min(Number(limit) || 10, 50),
    })

    return grouped.map((g) => ({
      productId: g.productId,
      name: g.productName,
      unitsSold: g._sum.quantity ?? 0,
      revenue: Number(g._sum.subtotal ?? 0),
    }))
  }

  /** Orders by status breakdown */
  @Get('orders-by-status')
  async ordersByStatus(@Query('storeId') storeId: string) {
    const sid = await resolveStoreId(this.prisma, storeId)
    return this.prisma.order.groupBy({
      by: ['status'],
      where: { storeId: sid },
      _count: true,
    })
  }

  /** Revenue by day for chart */
  @Get('revenue-chart')
  async revenueChart(
    @Query('storeId') storeId: string,
    @Query('days') days?: string,
  ) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const d = Number(days) || 14
    const since = new Date()
    since.setDate(since.getDate() - d)

    const orders = await this.prisma.order.findMany({
      where: { storeId: sid, createdAt: { gte: since } },
      select: { total: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    })

    const byDay: Record<string, number> = {}
    for (let i = d; i >= 0; i--) {
      const d2 = new Date()
      d2.setDate(d2.getDate() - i)
      byDay[d2.toISOString().slice(0, 10)] = 0
    }

    for (const o of orders) {
      const key = o.createdAt.toISOString().slice(0, 10)
      byDay[key] = (byDay[key] ?? 0) + Number(o.total)
    }

    return Object.entries(byDay).map(([date, revenue]) => ({ date, revenue }))
  }

  /** Inventory alerts: out-of-stock + low-stock counts */
  @Get('inventory-alerts')
  async inventoryAlerts(@Query('storeId') storeId: string) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const [outOfStock, lowStock] = await Promise.all([
      this.prisma.productVariant.count({
        where: { product: { storeId: sid, status: { not: 'ARCHIVED' } }, stock: 0 },
      }),
      this.prisma.productVariant.count({
        where: { product: { storeId: sid, status: { not: 'ARCHIVED' } }, stock: { gt: 0, lte: 5 } },
      }),
    ])
    return { outOfStock, lowStock }
  }

  /** Pending actions requiring admin attention */
  @Get('action-required')
  async actionRequired(@Query('storeId') storeId: string) {
    const sid = await resolveStoreId(this.prisma, storeId)

    const [pendingOrders, pendingRMAs, pendingReviews, failedShipments] = await Promise.all([
      this.prisma.order.count({ where: { storeId: sid, status: 'PENDING' } }),
      this.prisma.rMA.count({ where: { storeId: sid, status: 'REQUESTED' } }),
      this.prisma.review.count({ where: { product: { storeId: sid }, status: 'PENDING' } }),
      this.prisma.courierShipment.count({ where: { order: { storeId: sid }, status: 'FAILED' } }),
    ])

    return {
      pendingOrders,
      pendingRMAs,
      pendingReviews,
      failedShipments,
      total: pendingOrders + pendingRMAs + pendingReviews + failedShipments,
    }
  }
}
