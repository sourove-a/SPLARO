import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'
import { resolveStoreId } from '../../common/store.util'
import { PartnerTransactionsService } from './partners.service'

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

  async calculateOrderProfit(storeIdOrSlug: string, orderId: string) {
    const storeId = await this.sid(storeIdOrSlug)
    const existing = await this.prisma.profitCalculation.findUnique({ where: { orderId } })
    if (existing) return existing

    const order = await this.prisma.order.findFirst({
      where: { id: orderId, storeId },
      include: {
        items: { include: { product: { select: { costPrice: true } } } },
        courier: true,
        payments: true,
      },
    })
    if (!order || order.status !== 'DELIVERED') return null

    const grossRevenue = Number(order.total)
    const productCost = order.items.reduce(
      (sum, item) =>
        sum + Number(item.product.costPrice ?? item.price) * item.quantity,
      0,
    )
    const courierCost = Number(order.courier?.deliveryCharge ?? order.deliveryCharge ?? 0)
    const packagingCost = 15
    const paymentGatewayFee =
      order.paymentMethod === 'CASH_ON_DELIVERY'
        ? 0
        : grossRevenue * 0.025
    const discount = Number(order.discount)
    const returnLoss = 0

    const netProfit =
      grossRevenue -
      productCost -
      courierCost -
      packagingCost -
      paymentGatewayFee -
      discount -
      returnLoss

    const partners = await this.prisma.partner.findMany({
      where: { storeId, isActive: true },
    })

    const partnerShares: Record<string, number> = {}
    for (const partner of partners) {
      const share = (netProfit * Number(partner.sharePercent)) / 100
      partnerShares[partner.slug] = Math.round(share * 100) / 100

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

    const calculation = await this.prisma.profitCalculation.create({
      data: {
        storeId,
        orderId,
        grossRevenue,
        productCost,
        courierCost,
        packagingCost,
        paymentGatewayFee,
        discount,
        returnLoss,
        netProfit,
        partnerShares,
      },
    })

    this.logger.log(`Profit calculated for ${order.invoiceNumber}: ${netProfit} BDT`)
    return calculation
  }

  async getSummary(storeId: string, from: Date, to: Date) {
    const calculations = await this.prisma.profitCalculation.findMany({
      where: {
        storeId,
        calculatedAt: { gte: from, lte: to },
      },
    })

    const totals = calculations.reduce(
      (acc, c) => ({
        grossRevenue: acc.grossRevenue + Number(c.grossRevenue),
        productCost: acc.productCost + Number(c.productCost),
        courierCost: acc.courierCost + Number(c.courierCost),
        packagingCost: acc.packagingCost + Number(c.packagingCost),
        paymentGatewayFee: acc.paymentGatewayFee + Number(c.paymentGatewayFee),
        discount: acc.discount + Number(c.discount),
        returnLoss: acc.returnLoss + Number(c.returnLoss),
        netProfit: acc.netProfit + Number(c.netProfit),
      }),
      {
        grossRevenue: 0,
        productCost: 0,
        courierCost: 0,
        packagingCost: 0,
        paymentGatewayFee: 0,
        discount: 0,
        returnLoss: 0,
        netProfit: 0,
      },
    )

    const partners = await this.prisma.partner.findMany({
      where: { storeId, isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        currentBalance: true,
        totalProfitShare: true,
        sharePercent: true,
      },
    })

    return { period: { from, to }, totals, orderCount: calculations.length, partners }
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
