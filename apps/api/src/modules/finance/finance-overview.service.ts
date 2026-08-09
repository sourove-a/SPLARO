import { Injectable, NotFoundException } from '@nestjs/common'
import { ExpenseCategory, PaymentMethod, Prisma } from '@prisma/client'
import { PrismaService } from '../../common/prisma.service'
import { resolveStoreId } from '../../common/store.util'
import { ProfitLossService } from './profit-loss.service'
import { resolveFinanceWindow } from './finance-window.util'
import { profitMarginPercent } from './order-profit.util'
import {
  AD_CATEGORIES,
  COURIER_EXPENSE_CATEGORIES,
  FEE_EXPENSE_CATEGORIES,
  OPEX_CATEGORIES,
  PACKAGING_CATEGORIES,
  RETURN_EXPENSE_CATEGORIES,
} from './expense-category.util'

const COD: PaymentMethod[] = ['CASH_ON_DELIVERY']

@Injectable()
export class FinanceOverviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profitLoss: ProfitLossService,
  ) {}

  private sid(storeIdOrSlug: string) {
    return resolveStoreId(this.prisma, storeIdOrSlug)
  }

  async getOverview(
    storeIdOrSlug: string,
    query: { preset?: string; from?: string; to?: string },
  ) {
    const storeId = await this.sid(storeIdOrSlug)
    const window = resolveFinanceWindow(query)
    await this.profitLoss.recalculateWindowAllocation(storeId, window.from, window.to)

    const [current, previous] = await Promise.all([
      this.metricsForWindow(storeId, window.from, window.to),
      this.metricsForWindow(storeId, window.previousFrom, window.previousTo),
    ])

    const netChangePct =
      previous.netProfit === 0
        ? current.netProfit === 0
          ? 0
          : null
        : Math.round(((current.netProfit - previous.netProfit) / Math.abs(previous.netProfit)) * 1000) /
          10

    return {
      period: {
        from: window.from.toISOString(),
        to: window.to.toISOString(),
        previousFrom: window.previousFrom.toISOString(),
        previousTo: window.previousTo.toISOString(),
      },
      formula: 'Sales − Total Costs',
      adAllocationNote:
        'Approved advertising expenses in this window are allocated across delivered orders by revenue weight.',
      comingNext: ['Cash flow ledger', 'Ads sync / ROAS', 'Packaging BOM', 'Loss intelligence'],
      settings: await this.profitLoss.getFinanceSettings(storeId),
      metrics: {
        ...current,
        netProfitChangePct: netChangePct,
        previousNetProfit: previous.netProfit,
      },
    }
  }

  async listOrderProfit(
    storeIdOrSlug: string,
    query: { preset?: string; from?: string; to?: string; page?: number; limit?: number },
  ) {
    const storeId = await this.sid(storeIdOrSlug)
    const window = resolveFinanceWindow(query)
    await this.profitLoss.recalculateWindowAllocation(storeId, window.from, window.to)

    const page = Math.max(1, Number(query.page) || 1)
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 25))
    const skip = (page - 1) * limit

    const where: Prisma.OrderWhereInput = {
      storeId,
      status: 'DELIVERED',
      deliveredAt: { gte: window.from, lte: window.to },
    }

    const [total, orders] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        include: { profitCalculation: true },
        orderBy: { deliveredAt: 'desc' },
        skip,
        take: limit,
      }),
    ])

    return {
      period: { from: window.from.toISOString(), to: window.to.toISOString() },
      page,
      limit,
      total,
      items: orders.map((order) => this.toOrderProfitRow({ ...order, profitCalc: order.profitCalculation })),
    }
  }

  async getOrderProfit(storeIdOrSlug: string, orderId: string) {
    const storeId = await this.sid(storeIdOrSlug)
    const order = await this.prisma.order.findFirst({
      where: {
        storeId,
        OR: [{ id: orderId }, { invoiceNumber: orderId }],
      },
      include: {
        profitCalculation: true,
        items: {
          include: {
            product: { select: { name: true, costPrice: true } },
            variant: { select: { sku: true } },
          },
        },
        courier: true,
        rmas: { select: { refundAmount: true, status: true } },
      },
    })
    if (!order) throw new NotFoundException('Order not found')

    let calc = order.profitCalculation
    if (!calc && order.status === 'DELIVERED') {
      calc = await this.profitLoss.calculateOrderProfit(storeId, order.id)
    }

    return {
      ...this.toOrderProfitRow({ ...order, profitCalc: calc }),
      items: order.items.map((item) => ({
        productName: item.productName,
        sku: item.variant?.sku ?? item.sku,
        quantity: item.quantity,
        unitPrice: Number(item.price),
        lineTotal: Number(item.subtotal),
        costPrice: item.product?.costPrice != null ? Number(item.product.costPrice) : null,
        incomplete: item.product?.costPrice == null,
      })),
      courierCharge: Number(order.courier?.deliveryCharge ?? order.deliveryCharge ?? 0),
      paymentMethod: order.paymentMethod,
    }
  }

  private async metricsForWindow(storeId: string, from: Date, to: Date) {
    const [orders, calcs, expenses, receivableAgg] = await Promise.all([
      this.prisma.order.findMany({
        where: { storeId, status: 'DELIVERED', deliveredAt: { gte: from, lte: to } },
        select: {
          id: true,
          subtotal: true,
          total: true,
          discount: true,
          paymentMethod: true,
          paymentStatus: true,
        },
      }),
      this.prisma.profitCalculation.findMany({
        where: { storeId, order: { status: 'DELIVERED', deliveredAt: { gte: from, lte: to } } },
      }),
      this.prisma.expense.findMany({
        where: { storeId, status: 'APPROVED', expenseDate: { gte: from, lte: to } },
        select: { category: true, amount: true },
      }),
      this.prisma.order.aggregate({
        where: {
          storeId,
          paymentMethod: { in: COD },
          paymentStatus: { notIn: ['PAID', 'REFUNDED'] },
          status: { in: ['DELIVERED', 'SHIPPED', 'COURIER_BOOKED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'] },
        },
        _sum: { total: true },
      }),
    ])

    const grossSales = orders.reduce((s, o) => s + Number(o.subtotal), 0)
    const netSales = orders.reduce((s, o) => s + Number(o.total), 0)
    const discount = orders.reduce((s, o) => s + Number(o.discount), 0)

    const sumCalc = (key: keyof (typeof calcs)[number]) =>
      calcs.reduce((s, c) => s + Number(c[key] ?? 0), 0)

    const expenseSum = (cats: ExpenseCategory[]) =>
      expenses.filter((e) => cats.includes(e.category)).reduce((s, e) => s + Number(e.amount), 0)

    const cogs = sumCalc('productCost')
    const packaging = sumCalc('packagingCost') || expenseSum(PACKAGING_CATEGORIES)
    const delivery = sumCalc('courierCost') || expenseSum(COURIER_EXPENSE_CATEGORIES)
    const adSpend = expenseSum(AD_CATEGORIES)
    const opEx = expenseSum(OPEX_CATEGORIES)
    const feeExpenses = expenseSum(FEE_EXPENSE_CATEGORIES)
    const returnExpense = expenseSum(RETURN_EXPENSE_CATEGORIES)
    const returnLoss = Math.max(sumCalc('returnLoss'), returnExpense)
    const paymentFees = sumCalc('paymentGatewayFee') + feeExpenses
    const allocatedAd = sumCalc('allocatedAdCost')
    const grossProfit = grossSales - cogs - packaging
    const totalCosts =
      cogs + packaging + delivery + paymentFees + discount + allocatedAd + returnLoss + opEx
    const netProfit = grossSales - totalCosts
    const cashIn = orders
      .filter((o) => o.paymentStatus === 'PAID' || !COD.includes(o.paymentMethod))
      .reduce((s, o) => s + Number(o.total), 0)
    const cashOut = expenses.reduce((s, e) => s + Number(e.amount), 0) + delivery + paymentFees
    const incompleteOrders = calcs.filter((c) => (c.incompleteReasons ?? []).length > 0).length

    return {
      orderCount: orders.length,
      incompleteOrders,
      grossSales: round2(grossSales),
      netSales: round2(netSales),
      cogs: round2(cogs),
      packaging: round2(packaging),
      delivery: round2(delivery),
      adSpend: round2(adSpend),
      opEx: round2(opEx),
      paymentFees: round2(paymentFees),
      discount: round2(discount),
      returnLoss: round2(returnLoss),
      grossProfit: round2(grossProfit),
      netProfit: round2(netProfit),
      marginPct: profitMarginPercent(netProfit, grossSales),
      cashIn: round2(cashIn),
      cashOut: round2(cashOut),
      receivableCod: round2(Number(receivableAgg._sum.total ?? 0)),
    }
  }

  private toOrderProfitRow(order: {
    id: string
    invoiceNumber: string
    deliveredAt: Date | null
    createdAt: Date
    paymentMethod: PaymentMethod
    paymentStatus: string
    profitCalc: {
      grossRevenue: Prisma.Decimal | number
      productCost: Prisma.Decimal | number
      packagingCost: Prisma.Decimal | number
      courierCost: Prisma.Decimal | number
      paymentGatewayFee: Prisma.Decimal | number
      discount: Prisma.Decimal | number
      allocatedAdCost?: Prisma.Decimal | number | null
      returnLoss: Prisma.Decimal | number
      netProfit: Prisma.Decimal | number
      incompleteReasons?: string[] | null
    } | null
  }) {
    const calc = order.profitCalc
    const gross = Number(calc?.grossRevenue ?? 0)
    const net = Number(calc?.netProfit ?? 0)
    return {
      id: order.id,
      orderNumber: order.invoiceNumber,
      deliveredAt: (order.deliveredAt ?? order.createdAt).toISOString(),
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      selling: round2(gross),
      productCost: round2(Number(calc?.productCost ?? 0)),
      packaging: round2(Number(calc?.packagingCost ?? 0)),
      courier: round2(Number(calc?.courierCost ?? 0)),
      paymentFee: round2(Number(calc?.paymentGatewayFee ?? 0)),
      discount: round2(Number(calc?.discount ?? 0)),
      allocatedAds: round2(Number(calc?.allocatedAdCost ?? 0)),
      returnLoss: round2(Number(calc?.returnLoss ?? 0)),
      netProfit: round2(net),
      marginPct: profitMarginPercent(net, gross),
      incompleteReasons: calc?.incompleteReasons ?? [],
    }
  }
}

function round2(n: number): number {
  return Math.round((Number.isFinite(n) ? n : 0) * 100) / 100
}
