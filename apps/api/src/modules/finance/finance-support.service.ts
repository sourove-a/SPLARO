import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'
import { FinanceAuditService } from '../../common/finance-audit.service'
import { ProfitLossService } from './profit-loss.service'
import { PartnersService } from './partners.service'
import { resolveStoreId } from '../../common/store.util'
import type { GoogleSheetType, SyncStatus } from '@prisma/client'

@Injectable()
export class DailyClosingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: FinanceAuditService,
    private readonly profitLoss: ProfitLossService,
  ) {}

  async list(storeId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit
    const [items, total] = await Promise.all([
      this.prisma.dailyClosing.findMany({
        where: { storeId },
        orderBy: { closingDate: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.dailyClosing.count({ where: { storeId } }),
    ])
    return { items, total, page, totalPages: Math.ceil(total / limit) }
  }

  async runClosing(storeId: string, date = new Date(), closedBy?: string) {
    const closingDate = new Date(date)
    closingDate.setHours(0, 0, 0, 0)

    const existing = await this.prisma.dailyClosing.findUnique({
      where: { storeId_closingDate: { storeId, closingDate } },
    })
    if (existing) return existing

    const start = new Date(closingDate)
    const end = new Date(closingDate)
    end.setHours(23, 59, 59, 999)

    const [orderAgg, expenseAgg, profitSummary, partners] = await Promise.all([
      this.prisma.order.aggregate({
        where: { storeId, createdAt: { gte: start, lte: end }, status: { not: 'CANCELLED' } },
        _count: true,
        _sum: { total: true },
      }),
      this.prisma.expense.aggregate({
        where: { storeId, expenseDate: { gte: start, lte: end }, status: 'APPROVED' },
        _sum: { amount: true },
      }),
      this.profitLoss.getSummary(storeId, start, end),
      this.prisma.partner.findMany({
        where: { storeId, isActive: true },
        select: { slug: true, name: true, currentBalance: true },
      }),
    ])

    const closing = await this.prisma.dailyClosing.create({
      data: {
        storeId,
        closingDate,
        totalOrders: orderAgg._count,
        totalRevenue: Number(orderAgg._sum.total ?? 0),
        totalExpenses: Number(expenseAgg._sum.amount ?? 0),
        netProfit: profitSummary.totals.netProfit,
        partnerBalances: Object.fromEntries(
          partners.map((p) => [p.slug, Number(p.currentBalance)]),
        ),
        closedBy,
        status: 'APPROVED',
        approvedBy: closedBy,
      },
    })

    await this.audit.log({
      storeId,
      action: 'CREATE',
      resource: 'DailyClosing',
      resourceId: closing.id,
      after: closing,
      userId: closedBy,
    })

    return closing
  }

  async approve(id: string, storeId: string, approvedBy?: string) {
    const closing = await this.prisma.dailyClosing.findFirst({ where: { id, storeId } })
    if (!closing) throw new NotFoundException('Daily closing not found')

    return this.prisma.dailyClosing.update({
      where: { id },
      data: { status: 'APPROVED', approvedBy },
    })
  }
}

const SHEET_TYPE_TO_TAB: Partial<Record<GoogleSheetType, string>> = {
  ORDERS: 'Orders',
  CUSTOMERS: 'Customers',
  PRODUCTS: 'Products & Stock',
  INVENTORY: 'Products & Stock',
  PARTNER_ACCOUNTS: 'Partner Accounts',
  EXPENSES: 'Expenses',
  PROFIT_LOSS: 'Profit & Loss',
  COURIER: 'Courier',
  PAYMENT: 'Payments',
  DAILY_SUMMARY: 'Daily Summary',
  TELEGRAM_LOGS: 'Telegram Logs',
  AI_JOBS: 'AI Jobs',
}

const CORE_WORKSPACE_TABS = new Set(['Orders', 'Customers', 'Products & Stock', 'Subscribers', 'Dashboard'])

@Injectable()
export class GoogleSheetsFinanceService {
  private sheetEnvMap: Record<GoogleSheetType, string> = {
    ORDERS: 'GOOGLE_SHEETS_ORDERS_ID',
    CUSTOMERS: 'GOOGLE_SHEETS_CUSTOMERS_ID',
    PRODUCTS: 'GOOGLE_SHEETS_PRODUCTS_ID',
    INVENTORY: 'GOOGLE_SHEETS_INVENTORY_ID',
    PARTNER_ACCOUNTS: 'GOOGLE_SHEETS_PARTNERS_ID',
    EXPENSES: 'GOOGLE_SHEETS_EXPENSES_ID',
    PROFIT_LOSS: 'GOOGLE_SHEETS_PROFIT_LOSS_ID',
    COURIER: 'GOOGLE_SHEETS_COURIER_ID',
    PAYMENT: 'GOOGLE_SHEETS_PAYMENT_ID',
    DAILY_SUMMARY: 'GOOGLE_SHEETS_DAILY_SUMMARY_ID',
    TELEGRAM_LOGS: 'GOOGLE_SHEETS_TELEGRAM_LOGS_ID',
    AI_JOBS: 'GOOGLE_SHEETS_AI_JOBS_ID',
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: FinanceAuditService,
  ) {}

  async getWorkspaceContext(storeId: string) {
    const [workspaceConn, sheetConfigs] = await Promise.all([
      this.prisma.googleWorkspaceConnection.findUnique({ where: { storeId } }),
      this.prisma.googleSheetConfig.findMany({ where: { storeId } }),
    ])

    const spreadsheetId = workspaceConn?.spreadsheetId?.trim() || null
    const configByTab = new Map(sheetConfigs.map((row) => [row.sheetTab, row]))

    return {
      workspaceConn,
      spreadsheetId,
      spreadsheetUrl: workspaceConn?.spreadsheetUrl ?? null,
      workspaceConnected: Boolean(workspaceConn?.isConnected),
      autoSyncEnabled: workspaceConn?.autoSyncEnabled ?? false,
      configByTab,
    }
  }

  async getDashboard(storeIdOrSlug: string) {
    const storeId = await resolveStoreId(this.prisma, storeIdOrSlug)
    const [logs, workspace] = await Promise.all([
      this.prisma.googleSheetSyncLog.findMany({
        where: { storeId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.getWorkspaceContext(storeId),
    ])

    const { spreadsheetId, configByTab, workspaceConn } = workspace

    const byType = Object.keys(this.sheetEnvMap).map((type) => {
      const sheetType = type as GoogleSheetType
      const tab = SHEET_TYPE_TO_TAB[sheetType]
      const wsConfig = tab ? configByTab.get(tab) : undefined
      const envKey = this.sheetEnvMap[sheetType]
      const envConfigured = Boolean(process.env[envKey])
      const wsConfigured = Boolean(
        spreadsheetId &&
          (wsConfig?.enabled ||
            (tab && CORE_WORKSPACE_TABS.has(tab)) ||
            wsConfig?.spreadsheetId),
      )
      const configured = envConfigured || wsConfigured

      const last = logs.find((l) => l.sheetType === sheetType)
      const wsLastSync = wsConfig?.lastSyncAt ?? workspaceConn?.lastSyncAt ?? null
      const wsLastError = wsConfig?.lastError ?? workspaceConn?.lastError ?? null

      let lastStatus = last?.status ?? null
      if (!lastStatus && configured) {
        if (wsLastError) lastStatus = 'FAILED' as SyncStatus
        else if (wsLastSync) lastStatus = 'COMPLETED' as SyncStatus
        else lastStatus = 'PENDING' as SyncStatus
      }

      return {
        sheetType,
        sheetId: process.env[envKey] ?? wsConfig?.spreadsheetId ?? spreadsheetId ?? null,
        configured,
        configuredVia: envConfigured ? 'env' : wsConfigured ? 'workspace' : null,
        lastSync: last?.syncedAt ?? last?.createdAt ?? wsLastSync ?? null,
        lastStatus,
        lastError: last?.errorMsg ?? wsLastError ?? null,
      }
    })

    const stats = {
      total: byType.length,
      configured: byType.filter((row) => row.configured).length,
      completed: byType.filter((row) => row.lastStatus === 'COMPLETED').length,
      failed: byType.filter((row) => row.lastStatus === 'FAILED').length,
      pending: byType.filter(
        (row) =>
          !row.lastStatus ||
          row.lastStatus === 'PENDING' ||
          row.lastStatus === 'SYNCING',
      ).length,
    }

    const connection = {
      workspaceConnected: workspace.workspaceConnected,
      spreadsheetLinked: Boolean(spreadsheetId),
      spreadsheetUrl: workspace.spreadsheetUrl,
      googleEmail: workspaceConn?.googleEmail ?? null,
      autoSyncEnabled: workspace.autoSyncEnabled,
      tokenHealth: workspaceConn?.tokenHealth ?? null,
      setupHref: '/dashboard/google-workspace/sheets-sync',
    }

    return { sheets: byType, stats, recentLogs: logs.slice(0, 20), connection }
  }

  async queueSync(
    storeId: string,
    sheetType: GoogleSheetType,
    resourceId?: string,
    resourceType?: string,
    payload?: unknown,
    triggeredBy?: string,
  ) {
    const envKey = this.sheetEnvMap[sheetType]
    const sheetId = process.env[envKey]

    const log = await this.prisma.googleSheetSyncLog.create({
      data: {
        storeId,
        sheetType,
        sheetId: sheetId ?? undefined,
        resourceId,
        resourceType,
        payload: payload as object | undefined,
        status: sheetId ? 'PENDING' : 'FAILED',
        errorMsg: sheetId ? undefined : `Missing env ${envKey}`,
        triggeredBy,
      },
    })

    if (sheetId) {
      await this.processSync(log.id)
    }

    return log
  }

  async processSync(logId: string) {
    const log = await this.prisma.googleSheetSyncLog.findUnique({ where: { id: logId } })
    if (!log) return null

    try {
      await this.prisma.googleSheetSyncLog.update({
        where: { id: logId },
        data: { status: 'SYNCING' },
      })

      // Row append handled by worker / google-sheets-sync tool
      const updated = await this.prisma.googleSheetSyncLog.update({
        where: { id: logId },
        data: {
          status: 'COMPLETED',
          syncedAt: new Date(),
          retryCount: { increment: 1 },
        },
      })

      await this.audit.log({
        storeId: log.storeId,
        action: 'SYNC',
        resource: 'GoogleSheetSyncLog',
        resourceId: logId,
        note: `Synced ${log.sheetType}`,
      })

      return updated
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Sync failed'
      return this.prisma.googleSheetSyncLog.update({
        where: { id: logId },
        data: { status: 'FAILED', errorMsg, retryCount: { increment: 1 } },
      })
    }
  }

  async syncAll(storeId: string, triggeredBy?: string) {
    const types = Object.keys(this.sheetEnvMap) as GoogleSheetType[]
    const results: unknown[] = []
    for (const sheetType of types) {
      results.push(await this.queueSync(storeId, sheetType, undefined, 'MANUAL', undefined, triggeredBy))
    }
    return results
  }

  async retryFailed(storeId: string) {
    const failed = await this.prisma.googleSheetSyncLog.findMany({
      where: { storeId, status: 'FAILED' },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })

    const results: unknown[] = []
    for (const log of failed) {
      results.push(await this.processSync(log.id))
    }
    return results
  }

  async getLogs(storeIdOrSlug: string, page = 1, limit = 30) {
    const storeId = await resolveStoreId(this.prisma, storeIdOrSlug)
    const skip = (page - 1) * limit
    const [items, total] = await Promise.all([
      this.prisma.googleSheetSyncLog.findMany({
        where: { storeId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.googleSheetSyncLog.count({ where: { storeId } }),
    ])
    return { items, total, page, totalPages: Math.ceil(total / limit) }
  }
}

@Injectable()
export class FinanceReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profitLoss: ProfitLossService,
    private readonly partners: PartnersService,
  ) {}

  async partnerHub(storeIdOrSlug: string) {
    const storeId = await resolveStoreId(this.prisma, storeIdOrSlug)

    const [
      partners,
      monthlyProfit,
      weeklyProfit,
      products,
      recentInvestments,
      recentExpenses,
      expensesByCategory,
      pendingTx,
      pendingExpenses,
    ] = await Promise.all([
      this.prisma.partner.findMany({
        where: { storeId, isActive: true },
        orderBy: { name: 'asc' },
      }),
      this.profitLoss.getMonthlyProfit(storeIdOrSlug),
      this.profitLoss.getWeeklyProfit(storeIdOrSlug),
      this.prisma.product.findMany({
        where: { storeId, status: { not: 'ARCHIVED' } },
        select: {
          id: true,
          name: true,
          basePrice: true,
          costPrice: true,
          soldCount: true,
          viewCount: true,
          variants: { select: { stock: true } },
          images: { take: 1, select: { url: true } },
        },
        orderBy: [{ soldCount: 'desc' }, { viewCount: 'desc' }],
        take: 100,
      }),
      this.prisma.partnerTransaction.findMany({
        where: { storeId, type: 'INVESTMENT', status: 'APPROVED' },
        include: { partner: { select: { id: true, name: true, slug: true } } },
        orderBy: { transactionDate: 'desc' },
        take: 30,
      }),
      this.prisma.expense.findMany({
        where: { storeId },
        include: { partner: { select: { name: true, slug: true } } },
        orderBy: { expenseDate: 'desc' },
        take: 20,
      }),
      this.prisma.expense.groupBy({
        by: ['category'],
        where: { storeId, status: 'APPROVED' },
        _sum: { amount: true },
      }),
      this.prisma.partnerTransaction.count({ where: { storeId, status: 'PENDING' } }),
      this.prisma.expense.count({ where: { storeId, status: 'PENDING' } }),
    ])

    const inventory = products.map((p) => {
      const stock = p.variants.reduce((s, v) => s + v.stock, 0)
      const retailUnit = Number(p.basePrice)
      const costUnit = Number(p.costPrice ?? retailUnit * 0.65)
      return {
        id: p.id,
        name: p.name,
        stock,
        soldCount: p.soldCount,
        viewCount: p.viewCount,
        retailUnit,
        costUnit,
        retailValue: stock * retailUnit,
        costValue: stock * costUnit,
        imageUrl: p.images[0]?.url ?? null,
        demandScore: p.soldCount * 3 + p.viewCount,
      }
    })

    const inventoryTotals = inventory.reduce(
      (acc, row) => ({
        totalUnits: acc.totalUnits + row.stock,
        totalCostValue: acc.totalCostValue + row.costValue,
        totalRetailValue: acc.totalRetailValue + row.retailValue,
        productCount: acc.productCount + 1,
        lowStockCount: acc.lowStockCount + (row.stock > 0 && row.stock <= 5 ? 1 : 0),
        outOfStockCount: acc.outOfStockCount + (row.stock === 0 ? 1 : 0),
      }),
      { totalUnits: 0, totalCostValue: 0, totalRetailValue: 0, productCount: 0, lowStockCount: 0, outOfStockCount: 0 },
    )

    const topProducts = [...inventory]
      .sort((a, b) => b.demandScore - a.demandScore)
      .slice(0, 10)

    const partnerRows = partners.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      email: p.email,
      phone: p.phone,
      avatarUrl: p.avatarUrl,
      sharePercent: Number(p.sharePercent),
      totalInvestment: Number(p.totalInvestment),
      totalWithdrawal: Number(p.totalWithdrawal),
      totalSalesContribution: Number(p.totalSalesContribution),
      totalExpenseShare: Number(p.totalExpenseShare),
      totalProfitShare: Number(p.totalProfitShare),
      currentBalance: Number(p.currentBalance),
    }))

    return {
      partners: partnerRows,
      totals: {
        combinedBalance: partnerRows.reduce((s, p) => s + p.currentBalance, 0),
        totalInvested: partnerRows.reduce((s, p) => s + p.totalInvestment, 0),
        totalWithdrawn: partnerRows.reduce((s, p) => s + p.totalWithdrawal, 0),
        totalProfitShare: partnerRows.reduce((s, p) => s + p.totalProfitShare, 0),
        monthlyRevenue: monthlyProfit.totals.grossRevenue,
        monthlyNetProfit: monthlyProfit.totals.netProfit,
        weeklyNetProfit: weeklyProfit.totals.netProfit,
        pendingApprovals: pendingTx + pendingExpenses,
      },
      profitLoss: {
        monthly: monthlyProfit,
        weekly: weeklyProfit,
      },
      inventory: {
        totals: inventoryTotals,
        items: inventory,
      },
      topProducts,
      recentInvestments: recentInvestments.map((tx) => ({
        id: tx.id,
        amount: Number(tx.amount),
        note: tx.note,
        date: tx.transactionDate,
        partner: tx.partner,
      })),
      recentExpenses: recentExpenses.map((e) => ({
        id: e.id,
        category: e.category,
        amount: Number(e.amount),
        note: e.note,
        status: e.status,
        date: e.expenseDate,
        partner: e.partner,
      })),
      expensesByCategory: expensesByCategory.map((e) => ({
        category: e.category,
        amount: Number(e._sum.amount ?? 0),
      })),
    }
  }

  async dashboard(storeIdOrSlug: string) {
    const storeId = await resolveStoreId(this.prisma, storeIdOrSlug)
    const [partners, pendingTx, pendingExpenses, dailyProfit, monthlyProfit] =
      await Promise.all([
        this.prisma.partner.findMany({
          where: { storeId, isActive: true },
          orderBy: { name: 'asc' },
        }),
        this.prisma.partnerTransaction.count({
          where: { storeId, status: 'PENDING' },
        }),
        this.prisma.expense.count({ where: { storeId, status: 'PENDING' } }),
        this.profitLoss.getDailyProfit(storeId),
        this.profitLoss.getMonthlyProfit(storeId),
      ])

    const recentActivity = await this.prisma.partnerTransaction.findMany({
      where: { storeId },
      include: { partner: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })

    const expensesByCategory = await this.prisma.expense.groupBy({
      by: ['category'],
      where: { storeId, status: 'APPROVED' },
      _sum: { amount: true },
    })

    return {
      totals: {
        revenue: monthlyProfit.totals.grossRevenue,
        expense: monthlyProfit.totals.productCost + monthlyProfit.totals.courierCost,
        netProfit: monthlyProfit.totals.netProfit,
        dailyNetProfit: dailyProfit.totals.netProfit,
      },
      partners: partners.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        currentBalance: Number(p.currentBalance),
        sharePercent: Number(p.sharePercent),
      })),
      pendingApprovals: pendingTx + pendingExpenses,
      recentActivity,
      expensesByCategory: expensesByCategory.map((e) => ({
        category: e.category,
        amount: Number(e._sum.amount ?? 0),
      })),
    }
  }

  async exportPartnerReport(storeIdOrSlug: string, partnerId: string) {
    const storeId = await resolveStoreId(this.prisma, storeIdOrSlug)
    const partner = await this.prisma.partner.findFirst({
      where: { id: partnerId, storeId },
      include: {
        transactions: { orderBy: { transactionDate: 'desc' } },
      },
    })
    if (!partner) throw new NotFoundException('Partner not found')

    await this.prisma.financeAuditLog.create({
      data: {
        storeId,
        action: 'EXPORT',
        resource: 'Partner',
        resourceId: partnerId,
        note: `Exported report for ${partner.name}`,
      },
    })

    return partner
  }

  async auditLogs(storeIdOrSlug: string, page = 1, limit = 30) {
    const storeId = await resolveStoreId(this.prisma, storeIdOrSlug)
    const skip = (page - 1) * limit
    const [items, total] = await Promise.all([
      this.prisma.financeAuditLog.findMany({
        where: { storeId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.financeAuditLog.count({ where: { storeId } }),
    ])
    return { items, total, page, totalPages: Math.ceil(total / limit) }
  }
}
