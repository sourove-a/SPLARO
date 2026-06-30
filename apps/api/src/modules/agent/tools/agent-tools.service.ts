import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common'
import { OrderStatus } from '@prisma/client'
import { PrismaService } from '../../../common/prisma.service'
import { resolveStoreId } from '../../../common/store.util'
import { DashboardService } from '../../dashboard/dashboard.service'
import { TelegramService } from '../../telegram/telegram.service'
import { PromptManager } from '../prompts/prompt.manager'
import { ConversationStore } from '../memory/conversation.store'
import { AgentDiagnosticsService } from '../diagnostics/agent-diagnostics.service'
import type { AgentHealthSnapshot } from '../agent.types'

@Injectable()
export class AgentToolsService {
  private readonly logger = new Logger(AgentToolsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly dashboard: DashboardService,
    @Inject(forwardRef(() => TelegramService))
    private readonly telegram: TelegramService,
    private readonly prompts: PromptManager,
    private readonly conversations: ConversationStore,
    private readonly diagnostics: AgentDiagnosticsService,
  ) {}

  async execute(
    storeIdRaw: string,
    sessionId: string,
    toolName: string,
    args: Record<string, unknown>,
    createdBy?: string,
  ): Promise<unknown> {
    const storeId = await resolveStoreId(this.prisma, storeIdRaw)

    switch (toolName) {
      case 'get_store_analytics':
        return this.getStoreAnalytics(storeId, String(args.period ?? 'today'))
      case 'get_order_list':
        return this.getOrderList(storeId, args)
      case 'get_low_stock_products':
        return this.getLowStock(storeId, Number(args.threshold ?? 10))
      case 'get_seo_gaps':
        return this.getSeoGaps(storeId, Number(args.limit ?? 20))
      case 'get_top_customers':
        return this.getTopCustomers(storeId, Number(args.limit ?? 5))
      case 'create_product_draft':
        return this.createProductDraft(storeId, args)
      case 'update_product':
        return this.updateProduct(storeId, args)
      case 'send_telegram_message':
        return this.sendTelegram(storeId, String(args.message ?? ''))
      case 'update_system_prompt':
        await this.prompts.updateSystemPrompt(
          storeId,
          String(args.prompt ?? ''),
          args.reason ? String(args.reason) : undefined,
          createdBy,
        )
        return { ok: true }
      case 'get_store_health':
        return this.getHealthSnapshot(storeIdRaw)
      case 'get_admin_health_report': {
        const snapshot = await this.getHealthSnapshot(storeIdRaw)
        return this.diagnostics.getAdminHealthReport(storeIdRaw, snapshot)
      }
      case 'get_integration_status':
        return this.diagnostics.getIntegrationStatus(storeIdRaw)
      case 'get_api_route_health':
        return this.diagnostics.getRouteHealth(storeIdRaw)
      case 'get_conversation_history':
        return this.conversations.getHistory(storeId, sessionId, Number(args.limit ?? 10))
      default:
        return { error: `Unknown tool: ${toolName}` }
    }
  }

  async getHealthSnapshot(storeIdRaw: string): Promise<AgentHealthSnapshot> {
    const storeId = await resolveStoreId(this.prisma, storeIdRaw)
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)

    const [ordersToday, revenueAgg, lowStockCount, seoGapCount, topCustomerRow] = await Promise.all([
      this.prisma.order.count({
        where: { storeId, createdAt: { gte: startOfDay }, status: { not: OrderStatus.CANCELLED } },
      }),
      this.prisma.order.aggregate({
        where: { storeId, createdAt: { gte: startOfDay }, status: { not: OrderStatus.CANCELLED } },
        _sum: { total: true },
      }),
      this.prisma.productVariant.count({
        where: {
          stock: { lt: 10 },
          product: { storeId, isPublished: true },
        },
      }),
      this.prisma.product.count({
        where: {
          storeId,
          OR: [
            { metaTitle: null },
            { metaTitle: '' },
            { metaDescription: null },
            { metaDescription: '' },
          ],
        },
      }),
      this.prisma.order.groupBy({
        by: ['customerId'],
        where: { storeId, customerId: { not: null } },
        _count: { id: true },
        _sum: { total: true },
        orderBy: { _sum: { total: 'desc' } },
        take: 1,
      }),
    ])

    let topCustomer: AgentHealthSnapshot['topCustomer'] = null
    const top = topCustomerRow[0]
    if (top?.customerId) {
      const customer = await this.prisma.customer.findUnique({ where: { id: top.customerId } })
      if (customer) {
        topCustomer = {
          name: `${customer.firstName} ${customer.lastName}`.trim() || customer.email || 'Customer',
          orders: top._count.id,
          spend: Number(top._sum.total ?? 0),
        }
      }
    }

    return {
      ordersToday,
      revenueToday: Number(revenueAgg._sum.total ?? 0),
      lowStockCount,
      seoGapCount,
      topCustomer,
    }
  }

  private async getStoreAnalytics(storeId: string, period: string) {
    const periodMap: Record<string, string> = {
      today: '1 Day',
      week: '7 Days',
      month: '30 Days',
    }
    const [stats, insights] = await Promise.all([
      this.dashboard.getStats(storeId, periodMap[period] ?? '1 Day'),
      this.dashboard.getInsights(storeId, periodMap[period] ?? '1 Day'),
    ])
    return { period, stats, insights }
  }

  private async getOrderList(storeId: string, args: Record<string, unknown>) {
    const limit = Math.min(Number(args.limit ?? 10), 50)
    const status = args.status ? String(args.status).toUpperCase() : undefined

    const orders = await this.prisma.order.findMany({
      where: {
        storeId,
        ...(status ? { status: status as OrderStatus } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        invoiceNumber: true,
        status: true,
        total: true,
        shippingName: true,
        createdAt: true,
        paymentStatus: true,
      },
    })

    return orders.map((o) => ({
      ...o,
      total: Number(o.total),
    }))
  }

  private async getLowStock(storeId: string, threshold: number) {
    const variants = await this.prisma.productVariant.findMany({
      where: {
        stock: { lt: threshold },
        product: { storeId, isPublished: true },
      },
      take: 30,
      include: { product: { select: { id: true, name: true, slug: true } } },
    })

    return variants.map((v) => ({
      productId: v.productId,
      productName: v.product.name,
      slug: v.product.slug,
      size: v.size,
      color: v.color,
      stock: v.stock,
    }))
  }

  private async getSeoGaps(storeId: string, limit: number) {
    const products = await this.prisma.product.findMany({
      where: {
        storeId,
        OR: [
          { metaTitle: null },
          { metaTitle: '' },
          { metaDescription: null },
          { metaDescription: '' },
        ],
      },
      take: Math.min(limit, 50),
      select: { id: true, name: true, slug: true, metaTitle: true, metaDescription: true },
    })
    return products
  }

  private async getTopCustomers(storeId: string, limit: number) {
    const grouped = await this.prisma.order.groupBy({
      by: ['customerId'],
      where: { storeId, customerId: { not: null } },
      _count: { id: true },
      _sum: { total: true },
      orderBy: { _sum: { total: 'desc' } },
      take: Math.min(limit, 20),
    })

    const results: Array<{
      customerId: string
      name: string
      email: string | null | undefined
      orders: number
      totalSpend: number
    }> = []
    for (const row of grouped) {
      if (!row.customerId) continue
      const customer = await this.prisma.customer.findUnique({ where: { id: row.customerId } })
      results.push({
        customerId: row.customerId,
        name: customer ? `${customer.firstName} ${customer.lastName}`.trim() : 'Unknown',
        email: customer?.email,
        orders: row._count.id,
        totalSpend: Number(row._sum.total ?? 0),
      })
    }
    return results
  }

  private slugify(value: string) {
    return value
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }

  private async createProductDraft(storeId: string, args: Record<string, unknown>) {
    const name = String(args.name ?? '').trim()
    if (!name) throw new Error('Product name is required')

    const slug = String(args.slug ?? this.slugify(name))
    const product = await this.prisma.product.create({
      data: {
        storeId,
        name,
        slug,
        description: args.description ? String(args.description) : null,
        metaTitle: args.metaTitle ? String(args.metaTitle) : null,
        metaDescription: args.metaDescription ? String(args.metaDescription) : null,
        basePrice: Number(args.price ?? 0),
        categoryId: args.categoryId ? String(args.categoryId) : null,
        isPublished: false,
        status: 'DRAFT',
        variants: {
          create: {
            price: Number(args.price ?? 0),
            stock: 0,
            size: 'M',
            color: 'Default',
          },
        },
      },
    })
    return { id: product.id, slug: product.slug, name: product.name }
  }

  private async updateProduct(storeId: string, args: Record<string, unknown>) {
    const productId = args.productId ? String(args.productId) : undefined
    const slug = args.slug ? String(args.slug) : undefined

    const existing = productId
      ? await this.prisma.product.findFirst({ where: { id: productId, storeId } })
      : slug
        ? await this.prisma.product.findFirst({ where: { slug, storeId } })
        : null

    if (!existing) throw new Error('Product not found')

    const data: Record<string, unknown> = {}
    if (args.name) data.name = String(args.name)
    if (args.description) data.description = String(args.description)
    if (args.metaTitle) data.metaTitle = String(args.metaTitle)
    if (args.metaDescription) data.metaDescription = String(args.metaDescription)
    if (args.slug) data.slug = String(args.slug)
    if (args.price !== undefined) data.basePrice = Number(args.price)
    if (args.isPublished !== undefined) data.isPublished = Boolean(args.isPublished)

    const updated = await this.prisma.product.update({
      where: { id: existing.id },
      data,
    })
    return { id: updated.id, slug: updated.slug, name: updated.name }
  }

  private async sendTelegram(storeId: string, message: string) {
    if (!message.trim()) throw new Error('Message is required')
    const text = message.slice(0, 4000)

    const tg = await this.prisma.telegramConfig.findUnique({ where: { storeId } })
    if (tg?.botToken && tg.chatId) {
      const res = await fetch(
        `https://api.telegram.org/bot${tg.botToken}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: tg.chatId, text }),
        },
      )
      if (!res.ok) {
        this.logger.warn(`Telegram send failed: ${res.status}`)
        return { ok: false, status: res.status }
      }
      return { ok: true }
    }

    await this.telegram.sendToStore(storeId, text)
    return { ok: true }
  }
}
