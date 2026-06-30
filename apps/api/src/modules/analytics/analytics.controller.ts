import { Controller, Get, Inject, Query } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'
import { resolveStoreId } from '../../common/store.util'
import { AnalyticsService } from './analytics.service'

function periodStart(period: string): Date {
  const now = new Date()
  const d = new Date(now)
  switch (period) {
    case '7d': d.setDate(d.getDate() - 7); break
    case '30d': d.setDate(d.getDate() - 30); break
    case '90d': d.setDate(d.getDate() - 90); break
    case '1y': d.setFullYear(d.getFullYear() - 1); break
    default: d.setDate(d.getDate() - 30)
  }
  return d
}

@Controller('admin/analytics')
export class AnalyticsController {
  constructor(
    @Inject(AnalyticsService) private readonly analytics: AnalyticsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('stats')
  getStats(@Query('storeId') storeId?: string, @Query('period') period?: string) {
    return this.analytics.getStats(storeId, period)
  }

  @Get('insights')
  getInsights(@Query('storeId') storeId?: string, @Query('period') period?: string) {
    return this.analytics.getInsights(storeId, period)
  }

  // ── Revenue over time ──────────────────────────────────────

  @Get('revenue')
  async revenue(@Query('storeId') storeId: string, @Query('period') period = '30d', @Query('group') group = 'day') {
    const sid = await resolveStoreId(this.prisma, storeId)
    const since = periodStart(period)

    const orders = await this.prisma.order.findMany({
      where: { storeId: sid, createdAt: { gte: since }, status: { notIn: ['CANCELLED'] } },
      select: { total: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    })

    const buckets = new Map<string, { date: string; revenue: number; orders: number }>()
    for (const o of orders) {
      const key = group === 'month'
        ? o.createdAt.toISOString().slice(0, 7)
        : o.createdAt.toISOString().slice(0, 10)
      const b = buckets.get(key) ?? { date: key, revenue: 0, orders: 0 }
      b.revenue += Number(o.total)
      b.orders += 1
      buckets.set(key, b)
    }

    return { data: [...buckets.values()], period, group }
  }

  // ── Top products ───────────────────────────────────────────

  @Get('top-products')
  async topProducts(@Query('storeId') storeId: string, @Query('period') period = '30d', @Query('limit') limit = 10) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const since = periodStart(period)

    const items = await this.prisma.orderItem.groupBy({
      by: ['productId', 'productName'],
      where: { order: { storeId: sid, createdAt: { gte: since }, status: { notIn: ['CANCELLED'] } } },
      _sum: { quantity: true, subtotal: true },
      orderBy: { _sum: { subtotal: 'desc' } },
      take: Number(limit),
    })

    return items.map((i) => ({
      productId: i.productId,
      name: i.productName,
      unitsSold: i._sum?.quantity ?? 0,
      revenue: Number(i._sum?.subtotal ?? 0),
    }))
  }

  // ── Customer cohorts ───────────────────────────────────────

  @Get('customer-cohorts')
  async customerCohorts(@Query('storeId') storeId: string, @Query('period') period = '90d') {
    const sid = await resolveStoreId(this.prisma, storeId)
    const since = periodStart(period)

    const [newCustomers, returning, totalOrders, avgOrderValue] = await Promise.all([
      this.prisma.customer.count({ where: { storeId: sid, firstOrderDate: { gte: since } } }),
      this.prisma.customer.count({ where: { storeId: sid, totalOrders: { gt: 1 }, lastOrderDate: { gte: since } } }),
      this.prisma.order.count({ where: { storeId: sid, createdAt: { gte: since }, status: { notIn: ['CANCELLED'] } } }),
      this.prisma.order.aggregate({
        where: { storeId: sid, createdAt: { gte: since }, status: { notIn: ['CANCELLED'] } },
        _avg: { total: true },
      }),
    ])

    return {
      period,
      newCustomers,
      returningCustomers: returning,
      totalOrders,
      avgOrderValue: Number(avgOrderValue._avg.total ?? 0).toFixed(2),
      retentionRate: newCustomers + returning > 0 ? ((returning / (newCustomers + returning)) * 100).toFixed(1) : '0',
    }
  }

  // ── Traffic sources ────────────────────────────────────────

  @Get('traffic')
  async traffic(@Query('storeId') storeId: string, @Query('period') period = '30d') {
    const sid = await resolveStoreId(this.prisma, storeId)
    const since = periodStart(period)

    const sources = await this.prisma.order.groupBy({
      by: ['trafficSource'],
      where: { storeId: sid, createdAt: { gte: since } },
      _count: { id: true },
      _sum: { total: true },
    })

    return sources.map((s) => ({
      source: s.trafficSource ?? 'direct',
      orders: s._count.id,
      revenue: Number(s._sum.total ?? 0),
    }))
  }

  // ── Inventory health ───────────────────────────────────────

  @Get('inventory-health')
  async inventoryHealth(@Query('storeId') storeId: string) {
    const sid = await resolveStoreId(this.prisma, storeId)

    const [outOfStock, lowStock, totalVariants] = await Promise.all([
      this.prisma.productVariant.count({ where: { product: { storeId: sid, isPublished: true }, stock: 0 } }),
      this.prisma.productVariant.count({ where: { product: { storeId: sid, isPublished: true }, stock: { gt: 0, lte: 5 } } }),
      this.prisma.productVariant.count({ where: { product: { storeId: sid, isPublished: true }, isActive: true } }),
    ])

    return { outOfStock, lowStock, healthy: totalVariants - outOfStock - lowStock, total: totalVariants }
  }

  // ── Conversion funnel ──────────────────────────────────────

  @Get('funnel')
  async funnel(@Query('storeId') storeId: string, @Query('period') period = '30d') {
    const sid = await resolveStoreId(this.prisma, storeId)
    const since = periodStart(period)

    const [carts, checkouts, orders, delivered] = await Promise.all([
      this.prisma.cartSession.count({ where: { storeId: sid, updatedAt: { gte: since } } }),
      this.prisma.order.count({ where: { storeId: sid, createdAt: { gte: since } } }),
      this.prisma.order.count({ where: { storeId: sid, createdAt: { gte: since }, status: { notIn: ['CANCELLED'] } } }),
      this.prisma.order.count({ where: { storeId: sid, createdAt: { gte: since }, status: 'DELIVERED' } }),
    ])

    return {
      period,
      steps: [
        { label: 'Carts created', count: carts },
        { label: 'Orders placed', count: checkouts },
        { label: 'Orders confirmed', count: orders },
        { label: 'Delivered', count: delivered },
      ],
    }
  }
}
