import { Injectable } from '@nestjs/common'
import { OrderStatus, PaymentStatus } from '@prisma/client'
import { PrismaService } from '../../common/prisma.service'
import { resolveStoreId } from '../../common/store.util'
import type {
  DashboardInsightsResponse,
  DashboardPeriod,
  DashboardStatsResponse,
} from './dashboard.types'
import {
  aggregateTopCategories,
  aggregateTopProducts,
  buildPaymentMix,
  buildPeriodWindow,
  buildRecentActivities,
  normalizePeriod,
  percentChange,
  qtyByProduct,
} from './dashboard.util'

const ACTIVE_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.CONFIRMED,
  OrderStatus.PROCESSING,
  OrderStatus.PACKED,
  OrderStatus.SHIPPED,
  OrderStatus.COURIER_BOOKED,
  OrderStatus.PICKED_UP,
  OrderStatus.IN_TRANSIT,
  OrderStatus.OUT_FOR_DELIVERY,
  OrderStatus.DELIVERED,
]

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  private async storeId(raw: string | undefined): Promise<string> {
    return resolveStoreId(this.prisma, raw ?? 'splaro')
  }

  private activeOrderFilter(storeId: string, since: Date) {
    return {
      storeId,
      createdAt: { gte: since },
      status: { not: OrderStatus.CANCELLED },
    } as const
  }

  async getStats(storeIdRaw: string | undefined, periodRaw: string | undefined): Promise<DashboardStatsResponse> {
    const storeId = await this.storeId(storeIdRaw)
    const period = normalizePeriod(periodRaw)
    const { since, previousSince } = buildPeriodWindow(period)

    const activeSince = this.activeOrderFilter(storeId, since)
    const activePrevious = {
      storeId,
      createdAt: { gte: previousSince, lt: since },
      status: { not: OrderStatus.CANCELLED },
    } as const

    const [
      revenueAgg,
      prevRevenueAgg,
      orders,
      prevOrders,
      customers,
      codRiskOrders,
      failedPayments,
    ] = await Promise.all([
      this.prisma.order.aggregate({
        where: activeSince,
        _sum: { total: true },
      }),
      this.prisma.order.aggregate({
        where: activePrevious,
        _sum: { total: true },
      }),
      this.prisma.order.count({ where: { storeId, createdAt: { gte: since } } }),
      this.prisma.order.count({ where: { storeId, createdAt: { gte: previousSince, lt: since } } }),
      this.prisma.customer.count({ where: { storeId, createdAt: { gte: since } } }),
      this.prisma.order.count({
        where: { storeId, isCodRisk: true, status: OrderStatus.PENDING },
      }),
      this.prisma.order.count({
        where: {
          storeId,
          paymentStatus: PaymentStatus.FAILED,
          createdAt: { gte: since },
        },
      }),
    ])

    const currentRevenue = Number(revenueAgg._sum.total ?? 0)
    const previousRevenue = Number(prevRevenueAgg._sum.total ?? 0)

    return {
      revenue: {
        value: currentRevenue,
        change: percentChange(currentRevenue, previousRevenue),
      },
      orders: {
        value: orders,
        change: percentChange(orders, prevOrders),
      },
      customers: { value: customers, change: 0 },
      avgOrderValue: {
        value: orders > 0 ? Math.round(currentRevenue / orders) : 0,
        change: 0,
      },
      alerts: {
        codRiskOrders,
        failedPayments,
      },
    }
  }

  async getInsights(
    storeIdRaw: string | undefined,
    periodRaw: string | undefined,
  ): Promise<DashboardInsightsResponse> {
    const storeId = await this.storeId(storeIdRaw)
    const period = normalizePeriod(periodRaw)
    const { since, previousSince } = buildPeriodWindow(period)

    const activeSince = this.activeOrderFilter(storeId, since)
    const activePrevious = {
      storeId,
      createdAt: { gte: previousSince, lt: since },
      status: { not: OrderStatus.CANCELLED },
    } as const

    const [orderItems, prevOrderItems, paymentGroups, recentOrders, recentCustomers, statusHistory] =
      await Promise.all([
        this.prisma.orderItem.findMany({
          where: { order: activeSince },
          select: {
            orderId: true,
            productId: true,
            productName: true,
            sku: true,
            quantity: true,
            subtotal: true,
            product: {
              select: {
                categoryId: true,
                category: { select: { id: true, name: true, image: true } },
              },
            },
          },
        }),
        this.prisma.orderItem.findMany({
          where: { order: activePrevious },
          select: { productId: true, quantity: true },
        }),
        this.prisma.order.groupBy({
          by: ['paymentMethod'],
          where: activeSince,
          _count: true,
          _sum: { total: true },
        }),
        this.prisma.order.findMany({
          where: { storeId, status: { in: ACTIVE_ORDER_STATUSES } },
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            invoiceNumber: true,
            shippingName: true,
            total: true,
            paymentMethod: true,
            paymentStatus: true,
            createdAt: true,
            deliveredAt: true,
          },
        }),
        this.prisma.customer.findMany({
          where: { storeId },
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: { id: true, firstName: true, lastName: true, createdAt: true },
        }),
        this.prisma.orderStatusHistory.findMany({
          where: { order: { storeId }, createdAt: { gte: since } },
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            status: true,
            createdAt: true,
            order: { select: { invoiceNumber: true } },
          },
        }),
      ])

    const paymentMix = buildPaymentMix(paymentGroups)

    return {
      topCategories: aggregateTopCategories(orderItems),
      topProducts: aggregateTopProducts(orderItems, qtyByProduct(prevOrderItems)),
      paymentMix: paymentMix.rows,
      paymentMixTotal: paymentMix.total,
      recentActivities: buildRecentActivities(recentOrders, recentCustomers, statusHistory),
    }
  }
}
