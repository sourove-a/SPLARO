import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'
import { resolveStoreId } from '../../common/store.util'
import { PartnerTransactionsService } from './partners.service'
import { allocateAdsRevenueWeighted, computeOrderProfit } from './order-profit.util'

@Injectable()
export class ProfitLossService {
  private readonly logger = new Logger(ProfitLossService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly transactions: PartnerTransactionsService,
  ) {}

  private sid(raw: string) {
    return resolveStoreId(this.prisma, raw)
  }

  async getFinanceSettings(storeIdOrSlug: string) {
    const storeId = await this.sid(storeIdOrSlug)
    const settings = await this.prisma.siteSettings.findUnique({
      where: { storeId },
      select: { defaultPackagingCostPerOrder: true, paymentFeePercent: true },
    })
    return {
      defaultPackagingCostPerOrder: Number(settings?.defaultPackagingCostPerOrder ?? 0),
      paymentFeePercent: Number(settings?.paymentFeePercent ?? 0),
    }
  }

  async updateFinanceSettings(
    storeIdOrSlug: string,
    patch: { defaultPackagingCostPerOrder?: number; paymentFeePercent?: number },
  ) {
    const storeId = await this.sid(storeIdOrSlug)
    const current = await this.getFinanceSettings(storeId)
    const next = {
      defaultPackagingCostPerOrder:
        patch.defaultPackagingCostPerOrder != null
          ? Math.max(0, Number(patch.defaultPackagingCostPerOrder) || 0)
          : current.defaultPackagingCostPerOrder,
      paymentFeePercent:
        patch.paymentFeePercent != null
          ? Math.min(100, Math.max(0, Number(patch.paymentFeePercent) || 0))
          : current.paymentFeePercent,
    }
    await this.prisma.siteSettings.upsert({
      where: { storeId },
      create: { storeId, ...next },
      update: next,
    })
    return next
  }

  async calculateOrderProfit(storeIdOrSlug: string, orderId: string, allocatedAdCost = 0) {
    const storeId = await this.sid(storeIdOrSlug)
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, storeId },
      include: {
        items: { include: { product: { select: { costPrice: true } } } },
        courier: true,
        rmas: { select: { refundAmount: true, status: true } },
      },
    })
    if (!order || order.status !== 'DELIVERED') return null

    const settings = await this.getFinanceSettings(storeId)
    const result = computeOrderProfit({
      grossRevenue: Number(order.subtotal),
      discount: Number(order.discount),
      courierCost: Number(order.courier?.deliveryCharge ?? order.deliveryCharge ?? 0),
      packagingCostPerOrder: settings.defaultPackagingCostPerOrder,
      paymentFeePercent: settings.paymentFeePercent,
      isCod: order.paymentMethod === 'CASH_ON_DELIVERY',
      returnLoss: order.rmas
        .filter((r) => ['REFUNDED', 'PROCESSED', 'CLOSED'].includes(r.status))
        .reduce((s, r) => s + Number(r.refundAmount ?? 0), 0),
      allocatedAdCost,
      lines: order.items.map((item) => ({
        unitPrice: Number(item.price),
        quantity: item.quantity,
        productCostPrice: item.product?.costPrice != null ? Number(item.product.costPrice) : null,
      })),
    })

    const existing = await this.prisma.profitCalculation.findUnique({ where: { orderId } })
    const data = {
      storeId,
      orderId,
      grossRevenue: result.grossRevenue,
      productCost: result.productCost,
      courierCost: result.courierCost,
      packagingCost: result.packagingCost,
      paymentGatewayFee: result.paymentGatewayFee,
      discount: result.discount,
      returnLoss: result.returnLoss,
      allocatedAdCost: result.allocatedAdCost,
      incompleteReasons: result.incompleteReasons,
      netProfit: result.netProfit,
      calculatedAt: new Date(),
      ...(existing ? {} : { partnerShares: {} as Record<string, number> }),
    }

    if (!existing && result.netProfit > 0) {
      const partners = await this.prisma.partner.findMany({ where: { storeId, isActive: true } })
      const partnerShares: Record<string, number> = {}
      for (const partner of partners) {
        const share = Math.round((result.netProfit * Number(partner.sharePercent)) / 100 * 100) / 100
        partnerShares[partner.slug] = share
        if (share > 0) {
          await this.transactions.create(storeId, {
            partnerId: partner.id,
            type: 'PROFIT_DISTRIBUTION',
            amount: share,
            orderId,
            note: `Profit share from order ${order.invoiceNumber}`,
            createdBy: 'system',
          })
        }
      }
      data.partnerShares = partnerShares
    }

    const calculation = existing
      ? await this.prisma.profitCalculation.update({ where: { orderId }, data })
      : await this.prisma.profitCalculation.create({ data })

    this.logger.log(`Profit calculated for ${order.invoiceNumber}: ${result.netProfit} BDT`)
    return calculation
  }

  async recalculateWindowAllocation(storeIdOrSlug: string, from: Date, to: Date) {
    const storeId = await this.sid(storeIdOrSlug)
    const [orders, adSpendAgg] = await Promise.all([
      this.prisma.order.findMany({
        where: { storeId, status: 'DELIVERED', deliveredAt: { gte: from, lte: to } },
        select: { id: true, subtotal: true },
        orderBy: { deliveredAt: 'asc' },
      }),
      this.prisma.expense.aggregate({
        where: {
          storeId,
          status: 'APPROVED',
          category: 'ADVERTISING',
          expenseDate: { gte: from, lte: to },
        },
        _sum: { amount: true },
      }),
    ])

    if (!orders.length) return { updated: 0, adSpend: 0 }

    const adSpend = Number(adSpendAgg._sum.amount ?? 0)
    const allocations = allocateAdsRevenueWeighted(
      adSpend,
      orders.map((o) => Number(o.subtotal)),
    )

    let updated = 0
    for (let i = 0; i < orders.length; i++) {
      try {
        await this.calculateOrderProfit(storeId, orders[i].id, allocations[i] ?? 0)
        updated++
      } catch (err) {
        this.logger.warn(
          `Profit recalc failed for ${orders[i].id}: ${err instanceof Error ? err.message : err}`,
        )
      }
    }
    return { updated, adSpend }
  }

  async getSummary(storeId: string, from: Date, to: Date) {
    const agg = await this.prisma.profitCalculation.aggregate({
      where: { storeId, calculatedAt: { gte: from, lte: to } },
      _count: { _all: true },
      _sum: {
        grossRevenue: true,
        productCost: true,
        courierCost: true,
        packagingCost: true,
        paymentGatewayFee: true,
        discount: true,
        returnLoss: true,
        allocatedAdCost: true,
        netProfit: true,
      },
    })

    const sum = agg._sum
    const money = (value: unknown) => Number(value ?? 0)

    return {
      period: { from, to },
      totals: {
        grossRevenue: money(sum.grossRevenue),
        productCost: money(sum.productCost),
        courierCost: money(sum.courierCost),
        packagingCost: money(sum.packagingCost),
        paymentGatewayFee: money(sum.paymentGatewayFee),
        discount: money(sum.discount),
        returnLoss: money(sum.returnLoss),
        allocatedAdCost: money(sum.allocatedAdCost),
        netProfit: money(sum.netProfit),
      },
      orderCount: agg._count._all,
    }
  }

  async getDailyProfit(storeIdOrSlug: string, date = new Date()) {
    const storeId = await this.sid(storeIdOrSlug)
    const start = new Date(date)
    start.setHours(0, 0, 0, 0)
    const end = new Date(date)
    end.setHours(23, 59, 59, 999)
    return this.getSummary(storeId, start, end)
  }

  async getWeeklyProfit(storeIdOrSlug: string) {
    const storeId = await this.sid(storeIdOrSlug)
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - 7)
    return this.getSummary(storeId, start, end)
  }

  async getMonthlyProfit(storeIdOrSlug: string) {
    const storeId = await this.sid(storeIdOrSlug)
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    return this.getSummary(storeId, start, now)
  }

  async getYearlyProfit(storeIdOrSlug: string) {
    const storeId = await this.sid(storeIdOrSlug)
    const now = new Date()
    const start = new Date(now.getFullYear(), 0, 1)
    return this.getSummary(storeId, start, now)
  }
}
