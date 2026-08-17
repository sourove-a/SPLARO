import { Inject, Injectable, Logger, BadRequestException, NotFoundException, forwardRef } from '@nestjs/common'
import { resolvePublicSiteUrl } from '@splaro/config'
import { bdPhoneLookupVariants } from '../../../common/bd-phone.util'
import { OrderStatus, type CourierProvider } from '@prisma/client'
import { PrismaService } from '../../../common/prisma.service'
import { resolveStoreId } from '../../../common/store.util'
import { DashboardService } from '../../dashboard/dashboard.service'
import { TelegramService } from '../../telegram/telegram.service'
import { CourierService } from '../../courier/courier.service'
import { SteadfastService } from '../../courier/providers/steadfast.service'
import { SeoService } from '../../seo/seo.service'
import { OrderStatusService } from '../../orders/order-status.service'
import { PromptManager } from '../prompts/prompt.manager'
import { ConversationStore } from '../memory/conversation.store'
import { AgentDiagnosticsService } from '../diagnostics/agent-diagnostics.service'
import type { AgentHealthSnapshot } from '../agent.types'
import { scoreProductSeo } from './seo-scoring.util'

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
    @Inject(forwardRef(() => CourierService))
    private readonly courier: CourierService,
    private readonly seo: SeoService,
    private readonly orderStatus: OrderStatusService,
  ) {}

  async execute(
    storeIdRaw: string,
    sessionId: string,
    toolName: string,
    args: Record<string, unknown>,
    createdBy?: string,
    opts?: { confirmed?: boolean; previousValues?: Record<string, unknown> | null },
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
      case 'get_orders_by_phone':
        return this.getOrdersByPhone(storeId, args)
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
      case 'get_partner_finance':
        return this.getPartnerFinance(storeId)
      case 'get_order_detail':
        return this.getOrderDetail(storeId, args)
      case 'update_order_status':
        return this.updateOrderStatus(storeId, args)
      case 'book_order_courier':
        return this.bookOrderCourier(storeId, args)
      case 'book_all_pending_courier':
        return this.bookAllPendingCourier(storeId, args)
      case 'generate_reorder_purchase_order':
        return this.generateReorderPurchaseOrder(storeId, args)
      case 'moderate_and_reply_reviews':
        return this.moderateAndReplyReviews(storeId, args)
      case 'audit_high_risk_orders':
        return this.auditHighRiskOrders(storeId, args)
      case 'get_profit_insights':
        return this.getProfitInsights(storeId, args)
      case 'generate_executive_daily_brief':
        return this.generateExecutiveDailyBrief(storeId, args)
      case 'fix_missing_seo_meta':
        return this.fixMissingSeoMeta(storeId, Number(args.limit ?? 25))
      case 'analyze_product_seo':
        return this.analyzeProductSeo(storeId, args)
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
    const sku =
      String(args.sku ?? '')
        .trim()
        .toUpperCase() ||
      `SPL-${slug
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '-')
        .replace(/^-|-$/g, '')}`.slice(0, 48)

    const product = await this.prisma.product.create({
      data: {
        storeId,
        name,
        slug,
        sku,
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
            sku: `${sku}-M`,
          },
        },
      },
    })
    // Lead with human handles — cuid is internal (admin edit URLs still use dbId).
    return {
      name: product.name,
      slug: product.slug,
      sku: product.sku,
      status: product.status,
      dbId: product.id,
      adminPath: `/dashboard/products/${product.id}/edit`,
    }
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

    let stockUpdate: { sku: string; stock: number } | null = null
    const stockRaw = args.stock ?? args.stockQuantity
    if (stockRaw !== undefined) {
      const stock = Math.max(0, Math.floor(Number(stockRaw)))
      const variantSku = args.variantSku ? String(args.variantSku) : undefined
      const variant = variantSku
        ? await this.prisma.productVariant.findFirst({
            where: { productId: existing.id, sku: variantSku },
          })
        : await this.prisma.productVariant.findFirst({
            where: { productId: existing.id },
            orderBy: { createdAt: 'asc' },
          })
      if (!variant) throw new Error('No variant found to update stock')
      const next = await this.prisma.productVariant.update({
        where: { id: variant.id },
        data: { stock },
      })
      stockUpdate = { sku: next.sku ?? next.id, stock: next.stock }
    }

    return {
      id: updated.id,
      slug: updated.slug,
      name: updated.name,
      isPublished: updated.isPublished,
      basePrice: Number(updated.basePrice),
      ...(stockUpdate ? { stockUpdate } : {}),
    }
  }

  private async getOrdersByPhone(storeId: string, args: Record<string, unknown>) {
    const phone = String(args.phone ?? '').trim()
    if (!phone) return { error: 'phone required' }
    const variants = bdPhoneLookupVariants(phone)
    if (!variants.length) return { error: 'Invalid phone' }
    const limit = Math.min(Number(args.limit ?? 10), 30)

    const phoneOr = variants.flatMap((p) => [
      { shippingPhone: { contains: p } },
      { customer: { phone: { contains: p } } },
    ])

    const orders = await this.prisma.order.findMany({
      where: { storeId, OR: phoneOr },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        invoiceNumber: true,
        status: true,
        total: true,
        shippingName: true,
        shippingPhone: true,
        paymentStatus: true,
        createdAt: true,
        customer: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
      },
    })

    const customer =
      orders.find((o) => o.customer)?.customer ??
      (await this.prisma.customer.findFirst({
        where: { storeId, OR: variants.map((p) => ({ phone: { contains: p } })) },
        select: { id: true, firstName: true, lastName: true, phone: true, email: true },
      }))

    return {
      phone,
      matchedVariants: variants,
      customer: customer
        ? {
            id: customer.id,
            name: `${customer.firstName} ${customer.lastName}`.trim(),
            phone: customer.phone,
            email: customer.email,
          }
        : null,
      orderCount: orders.length,
      orders: orders.map((o) => ({
        id: o.id,
        invoiceNumber: o.invoiceNumber,
        status: o.status,
        total: Number(o.total),
        shippingName: o.shippingName,
        shippingPhone: o.shippingPhone,
        paymentStatus: o.paymentStatus,
        createdAt: o.createdAt,
      })),
    }
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

  private async getPartnerFinance(storeId: string) {
    const [partners, pendingWithdrawals, pendingExpenses, pendingTxCount] = await Promise.all([
      this.prisma.partner.findMany({
        where: { storeId, isActive: true },
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          slug: true,
          sharePercent: true,
          currentBalance: true,
          totalInvestment: true,
          totalWithdrawal: true,
          totalProfitShare: true,
          totalExpenseShare: true,
        },
      }),
      this.prisma.partnerTransaction.findMany({
        where: { storeId, type: 'WITHDRAWAL', status: 'PENDING' },
        take: 20,
        orderBy: { createdAt: 'desc' },
        include: { partner: { select: { name: true, slug: true } } },
      }),
      this.prisma.expense.count({ where: { storeId, status: 'PENDING' } }),
      this.prisma.partnerTransaction.count({ where: { storeId, status: 'PENDING' } }),
    ])

    return {
      partners: partners.map((p) => ({
        ...p,
        sharePercent: Number(p.sharePercent),
        currentBalance: Number(p.currentBalance),
        totalInvestment: Number(p.totalInvestment),
        totalWithdrawal: Number(p.totalWithdrawal),
        totalProfitShare: Number(p.totalProfitShare),
        totalExpenseShare: Number(p.totalExpenseShare),
      })),
      pendingWithdrawals: pendingWithdrawals.map((w) => ({
        id: w.id,
        partner: w.partner?.name,
        amount: Number(w.amount),
        status: w.status,
        createdAt: w.createdAt,
      })),
      pendingExpenseCount: pendingExpenses,
      pendingTransactionCount: pendingTxCount,
      combinedBalance: partners.reduce((s, p) => s + Number(p.currentBalance), 0),
    }
  }

  private async resolveOrder(storeId: string, args: Record<string, unknown>) {
    const orderId = args.orderId ? String(args.orderId).trim() : undefined
    const invoiceNumber = args.invoiceNumber ? String(args.invoiceNumber).trim() : undefined

    if (orderId) {
      return this.prisma.order.findFirst({
        where: { id: orderId, storeId },
        include: {
          courier: { select: { consignmentId: true, trackingCode: true, provider: true, status: true } },
          customer: { select: { firstName: true, lastName: true, phone: true, email: true } },
        },
      })
    }

    if (invoiceNumber) {
      return this.prisma.order.findFirst({
        where: {
          storeId,
          OR: [
            { invoiceNumber },
            { invoiceNumber: { contains: invoiceNumber, mode: 'insensitive' } },
          ],
        },
        include: {
          courier: { select: { consignmentId: true, trackingCode: true, provider: true, status: true } },
          customer: { select: { firstName: true, lastName: true, phone: true, email: true } },
        },
      })
    }

    return null
  }

  private async getOrderDetail(storeId: string, args: Record<string, unknown>) {
    const order = await this.resolveOrder(storeId, args)
    if (!order) return { error: 'Order not found — provide orderId or invoiceNumber' }

    return {
      id: order.id,
      invoiceNumber: order.invoiceNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      total: Number(order.total),
      shippingName: order.shippingName,
      shippingPhone: order.shippingPhone,
      shippingDistrict: order.shippingDistrict,
      createdAt: order.createdAt,
      customer: order.customer
        ? {
            name: `${order.customer.firstName} ${order.customer.lastName}`.trim(),
            phone: order.customer.phone,
            email: order.customer.email,
          }
        : null,
      courier: order.courier
        ? {
            provider: order.courier.provider,
            consignmentId: order.courier.consignmentId,
            trackingCode: order.courier.trackingCode,
            status: order.courier.status,
          }
        : null,
    }
  }

  private async updateOrderStatus(storeId: string, args: Record<string, unknown>) {
    const status = String(args.status ?? '').toUpperCase()
    const allowed = [
      'CONFIRMED',
      'PROCESSING',
      'PACKED',
      'SHIPPED',
      'DELIVERED',
      'CANCELLED',
    ] as const
    if (!allowed.includes(status as (typeof allowed)[number])) {
      return { error: `Invalid status. Allowed: ${allowed.join(', ')}` }
    }

    const order = await this.resolveOrder(storeId, args)
    if (!order) return { error: 'Order not found' }

    const note = args.note ? String(args.note).trim() : undefined
    try {
      const updated = await this.orderStatus.applyStatusChange(order.id, status, note, storeId, {
        notePrefix: '[AI] ',
      })
      return {
        ok: true,
        id: updated.id,
        invoiceNumber: updated.invoiceNumber,
        previousStatus: order.status,
        status: updated.status,
      }
    } catch (err) {
      let message = 'Status update failed'
      if (err instanceof BadRequestException || err instanceof NotFoundException) {
        const res = err.getResponse()
        message =
          typeof res === 'string'
            ? res
            : Array.isArray((res as { message?: unknown }).message)
              ? ((res as { message: string[] }).message).join(', ')
              : String((res as { message?: string }).message ?? err.message)
      } else if (err instanceof Error) {
        message = err.message
      }
      return {
        ok: false,
        error: message,
        previousStatus: order.status,
      }
    }
  }

  private async bookOrderCourier(storeId: string, args: Record<string, unknown>) {
    const order = await this.resolveOrder(storeId, args)
    if (!order) return { error: 'Order not found' }

    const providerRaw = args.provider ? String(args.provider).toUpperCase() : 'STEADFAST'
    const provider = providerRaw as CourierProvider

    try {
      const result = await this.courier.bookCourier(order.id, provider)
      return {
        ok: result.success,
        orderId: order.id,
        invoiceNumber: order.invoiceNumber,
        consignmentId: result.consignmentId ?? null,
        trackingCode: result.trackingCode ?? null,
        trackingUrl: result.trackingUrl ?? null,
        simulated: result.simulated ?? false,
        alreadyBooked: result.alreadyBooked ?? false,
        error: result.error ?? null,
      }
    } catch (err) {
      return {
        ok: false,
        orderId: order.id,
        error: err instanceof Error ? err.message : 'Courier booking failed',
      }
    }
  }

  private async fixMissingSeoMeta(storeId: string, limit: number) {
    const siteUrl = resolvePublicSiteUrl(process.env['STOREFRONT_URL'])
    const gaps = await this.getSeoGaps(storeId, Math.min(limit, 50))
    if (!gaps.length) {
      return { ok: true, message: 'No products with missing meta', updated: 0, total: 0 }
    }

    const result = await this.seo.fillMissingProductMeta(storeId, siteUrl)
    return {
      ok: true,
      total: result.total,
      updated: result.updated,
      skipped: result.skipped,
      avgScoreAfter: result.avgScoreAfter,
      products: result.products.slice(0, 15),
    }
  }

  summarizeResult(result: unknown): string {
    if (result === null || result === undefined) return 'No result'
    if (typeof result === 'string') return result.slice(0, 1500)

    const r = result as {
      error?: string
      ok?: boolean
      simulated?: boolean
      consignmentId?: string | null
      invoiceNumber?: string
      trackingCode?: string | null
      orderCount?: number
      updated?: number
    }

    if (r.error) return `Error: ${r.error}`

    if (r.simulated === true || (typeof r.consignmentId === 'string' && r.consignmentId.startsWith('DEV-'))) {
      return (
        `⚠ Courier SIMULATED / not live — consignment ${r.consignmentId ?? 'n/a'}` +
        (r.invoiceNumber ? ` for ${r.invoiceNumber}` : '') +
        '. Steadfast keys check করুন; green success নয়।'
      )
    }

    if (r.ok === false) {
      return `Failed: ${r.error ?? JSON.stringify(result).slice(0, 800)}`
    }

    if (r.ok === true && r.consignmentId) {
      return `Courier booked · ${r.consignmentId}${r.trackingCode ? ` · track ${r.trackingCode}` : ''}`
    }

    if (typeof r.orderCount === 'number') {
      return `Found ${r.orderCount} order(s)`
    }

    if (typeof r.updated === 'number') {
      return `Updated ${r.updated}`
    }

    return JSON.stringify(result, null, 0).slice(0, 1500)
  }

  async capturePreviousValues(
    storeIdRaw: string,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<Record<string, unknown> | null> {
    const storeId = await resolveStoreId(this.prisma, storeIdRaw)

    if (toolName === 'update_product' || toolName === 'fix_missing_seo_meta') {
      const productId = args.productId ? String(args.productId) : undefined
      const slug = args.slug ? String(args.slug) : undefined
      const existing = productId
        ? await this.prisma.product.findFirst({ where: { id: productId, storeId } })
        : slug
          ? await this.prisma.product.findFirst({ where: { slug, storeId } })
          : null
      if (!existing) return null
      return {
        id: existing.id,
        name: existing.name,
        metaTitle: existing.metaTitle,
        metaDescription: existing.metaDescription,
        basePrice: Number(existing.basePrice),
        status: existing.status,
      }
    }

    if (toolName === 'update_order_status') {
      const order = await this.resolveOrder(storeId, args)
      if (!order) return null
      return { id: order.id, invoiceNumber: order.invoiceNumber, status: order.status }
    }

    if (toolName === 'book_order_courier') {
      const order = await this.resolveOrder(storeId, args)
      if (!order) return null
      return {
        id: order.id,
        invoiceNumber: order.invoiceNumber,
        status: order.status,
        courier: order.courier?.consignmentId ?? null,
      }
    }

    return null
  }

  private async analyzeProductSeo(storeId: string, args: Record<string, unknown>) {
    const productId = args.productId ? String(args.productId) : undefined
    const slug = args.slug ? String(args.slug) : undefined
    const product = productId
      ? await this.prisma.product.findFirst({ where: { id: productId, storeId } })
      : slug
        ? await this.prisma.product.findFirst({ where: { slug, storeId } })
        : null
    if (!product) return { error: 'Product not found — provide productId or slug' }
    return scoreProductSeo(product)
  }

  private async bookAllPendingCourier(storeId: string, args: Record<string, unknown>) {
    const limit = Math.min(Math.max(1, Number(args.limit ?? 20)), 50)
    const pendingOrders = await this.prisma.order.findMany({
      where: {
        storeId,
        status: { in: [OrderStatus.CONFIRMED, OrderStatus.PROCESSING] },
        courier: { is: null },
      },
      take: limit,
      orderBy: { createdAt: 'asc' },
    })

    if (pendingOrders.length === 0) {
      return {
        message: 'No pending orders waiting for courier booking.',
        totalProcessed: 0,
        bookedCount: 0,
        orders: [],
      }
    }

    const results: Array<{ orderId: string; invoiceNumber: string; success: boolean; consignmentId?: string; error?: string }> = []

    for (const order of pendingOrders) {
      try {
        const bookRes = await this.courier.bookCourier(order.id, 'STEADFAST' as CourierProvider, { storeId })
        if (bookRes.success && bookRes.consignmentId) {
          await this.orderStatus.applyStatusChange(
            storeId,
            order.id,
            OrderStatus.PACKED,
            `Autonomous bulk courier dispatch (${bookRes.consignmentId})`,
          )
          results.push({
            orderId: order.id,
            invoiceNumber: order.invoiceNumber,
            success: true,
            consignmentId: bookRes.consignmentId,
          })
        } else {
          results.push({
            orderId: order.id,
            invoiceNumber: order.invoiceNumber,
            success: false,
            error: bookRes.error || 'Courier rejected',
          })
        }
      } catch (err) {
        results.push({
          orderId: order.id,
          invoiceNumber: order.invoiceNumber,
          success: false,
          error: err instanceof Error ? err.message : 'Booking failed',
        })
      }
    }

    const bookedCount = results.filter((r) => r.success).length
    return {
      message: `Bulk dispatch: ${bookedCount}/${pendingOrders.length} orders successfully booked on Steadfast.`,
      totalProcessed: pendingOrders.length,
      bookedCount,
      failedCount: pendingOrders.length - bookedCount,
      results,
    }
  }

  private async generateReorderPurchaseOrder(storeId: string, args: Record<string, unknown>) {
    const threshold = Number(args.threshold ?? 5)
    const targetStock = Number(args.targetStock ?? 20)
    const preferredSupplier = args.supplierName ? String(args.supplierName).trim() : 'Dhaka Silk & Cotton Mill'

    const lowStockVariants = await this.prisma.productVariant.findMany({
      where: {
        product: { storeId },
        stock: { lte: threshold },
      },
      include: {
        product: true,
      },
      take: 50,
    })

    if (lowStockVariants.length === 0) {
      return {
        message: `No variants currently below threshold of ${threshold} units. All stock is healthy.`,
        created: false,
      }
    }

    let supplier = await this.prisma.supplier.findFirst({
      where: { storeId, name: { equals: preferredSupplier, mode: 'insensitive' } },
    })

    if (!supplier) {
      supplier = await this.prisma.supplier.create({
        data: {
          storeId,
          name: preferredSupplier,
          phone: '01700000000',
          email: 'procurement@splaro.co',
          address: 'Dhaka, Bangladesh',
        },
      })
    }

    const poNumber = `PO-${Date.now().toString().slice(-6)}`
    let subtotal = 0

    const items = lowStockVariants.map((v) => {
      const orderQty = Math.max(1, targetStock - v.stock)
      const cost = Number(v.product.costPrice ?? (Number(v.price) * 0.5))
      subtotal += orderQty * cost
      return {
        productName: `${v.product.name}${v.size || v.color ? ` (${[v.size, v.color].filter(Boolean).join(' / ')})` : ''}`,
        sku: v.sku || v.product.sku || 'SKU-GEN',
        quantity: orderQty,
        unitCost: cost,
      }
    })

    const po = await this.prisma.purchaseOrder.create({
      data: {
        storeId,
        supplierId: supplier.id,
        poNumber,
        status: 'DRAFT',
        subtotal,
        total: subtotal,
        notes: `Autonomous AI re-order draft for ${items.length} low-stock variants (threshold <= ${threshold}).`,
        items: {
          create: items,
        },
      },
      include: {
        items: true,
      },
    })

    return {
      message: `Created Draft Purchase Order ${po.poNumber} with ${items.length} items for ${supplier.name}.`,
      created: true,
      poNumber: po.poNumber,
      supplier: supplier.name,
      totalAmount: subtotal,
      totalUnits: items.reduce((acc, i) => acc + i.quantity, 0),
      items: po.items.map((i) => ({ name: i.productName, qty: i.quantity, unitCost: Number(i.unitCost) })),
    }
  }

  private async moderateAndReplyReviews(storeId: string, args: Record<string, unknown>) {
    const limit = Math.min(Math.max(1, Number(args.limit ?? 10)), 30)
    const autoApprove = args.autoApprove !== false

    const reviews = await this.prisma.review.findMany({
      where: {
        product: { storeId },
        OR: [{ status: 'PENDING' }, { adminReply: null }],
      },
      include: {
        product: { select: { id: true, name: true, slug: true } },
        customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
    })

    if (reviews.length === 0) {
      return {
        message: 'No pending or unreplied reviews to process.',
        processedCount: 0,
      }
    }

    const processed: Array<{
      reviewId: string
      product: string
      customer: string
      rating: number
      status: string
      reply: string
    }> = []

    for (const r of reviews) {
      let reply = ''
      if (r.rating >= 4) {
        reply = 'SPLARO-র সাথে থাকার জন্য এবং চমৎকার রিভিউ দেওয়ার জন্য ধন্যবাদ! আপনার সন্তুষ্টিই আমাদের সর্বোচ্চ প্রেরণা।'
      } else if (r.rating === 3) {
        reply = 'আপনার মতামতের জন্য ধন্যবাদ। আমরা প্রোডাক্টটির ফিট ও কোয়ালিটি আরও উন্নত করতে সচেষ্ট। যেকোনো প্রয়োজনে আমাদের হেল্পলাইনে যোগাযোগ করতে পারেন।'
      } else {
        reply = 'আপনার অনাকাঙ্ক্ষিত অভিজ্ঞতার জন্য আমরা আন্তরিকভাবে দুঃখিত। বিষয়টি সমাধান করতে অনুগ্রহ করে আমাদের কাস্টমার কেয়ারে (01905010205) যোগাযোগ করুন।'
      }

      await this.prisma.review.update({
        where: { id: r.id },
        data: {
          status: autoApprove ? 'APPROVED' : r.status,
          adminReply: reply,
          adminReplyAt: new Date(),
        },
      })

      const custName = r.customer ? `${r.customer.firstName} ${r.customer.lastName}`.trim() : 'Customer'
      processed.push({
        reviewId: r.id,
        product: r.product.name,
        customer: custName,
        rating: r.rating,
        status: autoApprove ? 'APPROVED' : r.status,
        reply,
      })
    }

    return {
      message: `Processed ${processed.length} reviews: updated status and posted brand replies.`,
      processedCount: processed.length,
      reviews: processed,
    }
  }

  private async auditHighRiskOrders(storeId: string, args: Record<string, unknown>) {
    const limit = Math.min(Math.max(1, Number(args.limit ?? 50)), 100)
    const unfulfilled = await this.prisma.order.findMany({
      where: {
        storeId,
        status: { in: [OrderStatus.PENDING, OrderStatus.CONFIRMED] },
      },
      include: {
        customer: true,
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
    })

    if (unfulfilled.length === 0) {
      return { message: 'No pending orders to audit.', totalAudited: 0, highRiskCount: 0, flags: [] }
    }

    const flags: Array<{
      orderId: string
      invoiceNumber: string
      customerName: string
      phone: string
      total: number
      riskLevel: 'HIGH' | 'MEDIUM' | 'LOW'
      reasons: string[]
      recommendedAction: string
    }> = []

    for (const o of unfulfilled) {
      const reasons: string[] = []
      const phone = o.shippingPhone || o.customer?.phone || ''
      const total = Number(o.total)

      const variants = bdPhoneLookupVariants(phone)
      if (!variants || variants.length === 0 || phone.replace(/\D/g, '').length < 10) {
        reasons.push('Invalid Bangladeshi phone number format')
      }

      if (variants && variants.length > 0) {
        const cancelledCount = await this.prisma.order.count({
          where: {
            storeId,
            shippingPhone: { in: variants },
            status: { in: [OrderStatus.CANCELLED, OrderStatus.RETURNED] },
          },
        })
        if (cancelledCount >= 2) {
          reasons.push(`Customer has ${cancelledCount} past cancelled/returned orders`)
        }
      }

      if (total >= 10000 && !o.paymentMethod?.toLowerCase().includes('bkash')) {
        reasons.push(`High COD order value (৳${total.toLocaleString('en-US')})`)
      }

      const addressStr =
        typeof o.shippingAddress === 'string'
          ? o.shippingAddress
          : (o.shippingAddress as Record<string, unknown> | null)?.['address1']
            ? String((o.shippingAddress as Record<string, unknown>)['address1'])
            : o.shippingDistrict || ''

      if (addressStr.trim().length < 8) {
        reasons.push('Incomplete or overly short shipping address')
      }

      let riskLevel: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW'
      let recommendedAction = 'SAFE_TO_DISPATCH — proceed to packing'

      if (reasons.length >= 2 || reasons.some((r) => r.includes('cancelled/returned') || r.includes('Invalid'))) {
        riskLevel = 'HIGH'
        recommendedAction = 'HOLD_SHIPMENT — call customer for phone confirmation before dispatch'
      } else if (reasons.length === 1) {
        riskLevel = 'MEDIUM'
        recommendedAction = 'CALL_VERIFY — quick confirmation call recommended'
      }

      const custName = o.shippingName || (o.customer ? `${o.customer.firstName} ${o.customer.lastName}`.trim() : 'Customer')

      flags.push({
        orderId: o.id,
        invoiceNumber: o.invoiceNumber,
        customerName: custName,
        phone,
        total,
        riskLevel,
        reasons,
        recommendedAction,
      })
    }

    const highRisk = flags.filter((f) => f.riskLevel === 'HIGH')
    const mediumRisk = flags.filter((f) => f.riskLevel === 'MEDIUM')

    return {
      message: `Audited ${unfulfilled.length} pending orders: ${highRisk.length} High Risk, ${mediumRisk.length} Medium Risk, ${unfulfilled.length - highRisk.length - mediumRisk.length} Safe.`,
      totalAudited: unfulfilled.length,
      highRiskCount: highRisk.length,
      mediumRiskCount: mediumRisk.length,
      orders: flags,
    }
  }

  private async getProfitInsights(storeId: string, args: Record<string, unknown>) {
    const period = String(args.period ?? 'month')
    const now = new Date()
    let startDate = new Date(0)

    if (period === 'today') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    } else if (period === 'week') {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    } else if (period === 'month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1)
    }

    const orders = await this.prisma.order.findMany({
      where: {
        storeId,
        createdAt: { gte: startDate },
        status: { notIn: [OrderStatus.CANCELLED, OrderStatus.RETURNED] },
      },
      include: {
        items: {
          include: {
            product: { select: { name: true, costPrice: true, basePrice: true } },
          },
        },
      },
    })

    let grossRevenue = 0
    let estimatedCOGS = 0
    let shippingFeesCollected = 0
    const productSalesMap = new Map<string, { name: string; revenue: number; cogs: number; profit: number; units: number }>()

    for (const o of orders) {
      grossRevenue += Number(o.total)
      shippingFeesCollected += Number(o.deliveryCharge ?? 0)

      for (const item of o.items) {
        const itemRev = Number(item.subtotal)
        const unitCost = Number(item.product?.costPrice ?? Number(item.price) * 0.5)
        const itemCogs = unitCost * item.quantity
        const itemProfit = itemRev - itemCogs

        estimatedCOGS += itemCogs

        const existing = productSalesMap.get(item.productName) ?? {
          name: item.productName,
          revenue: 0,
          cogs: 0,
          profit: 0,
          units: 0,
        }
        existing.revenue += itemRev
        existing.cogs += itemCogs
        existing.profit += itemProfit
        existing.units += item.quantity
        productSalesMap.set(item.productName, existing)
      }
    }

    const grossProfit = grossRevenue - estimatedCOGS
    const marginPct = grossRevenue > 0 ? ((grossProfit / grossRevenue) * 100).toFixed(1) : '0'

    const topProfitableProducts = Array.from(productSalesMap.values())
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 5)

    return {
      period,
      totalOrders: orders.length,
      grossRevenue,
      estimatedCOGS,
      grossProfit,
      marginPercent: `${marginPct}%`,
      shippingFeesCollected,
      topProfitableProducts,
    }
  }

  private async generateExecutiveDailyBrief(storeId: string, args: Record<string, unknown>) {
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)
    const yesterdayStart = new Date(startOfDay.getTime() - 24 * 60 * 60 * 1000)

    const [
      todayOrders,
      todayRevenueAgg,
      yesterdayRevenueAgg,
      packingQueueCount,
      lowStockVariants,
      pendingReviewsCount,
    ] = await Promise.all([
      this.prisma.order.count({
        where: { storeId, createdAt: { gte: startOfDay }, status: { not: OrderStatus.CANCELLED } },
      }),
      this.prisma.order.aggregate({
        where: { storeId, createdAt: { gte: startOfDay }, status: { not: OrderStatus.CANCELLED } },
        _sum: { total: true },
      }),
      this.prisma.order.aggregate({
        where: { storeId, createdAt: { gte: yesterdayStart, lt: startOfDay }, status: { not: OrderStatus.CANCELLED } },
        _sum: { total: true },
      }),
      this.prisma.order.count({
        where: { storeId, status: { in: [OrderStatus.CONFIRMED, OrderStatus.PROCESSING] } },
      }),
      this.prisma.productVariant.findMany({
        where: { product: { storeId }, stock: { lte: 5 } },
        include: { product: { select: { name: true } } },
        take: 5,
      }),
      this.prisma.review.count({
        where: { product: { storeId }, status: 'PENDING' },
      }),
    ])

    const todayRev = Number(todayRevenueAgg._sum.total ?? 0)
    const yesterdayRev = Number(yesterdayRevenueAgg._sum.total ?? 0)

    const briefText = [
      `🌟 *SPLARO Command — Executive Daily Brief*`,
      `📅 ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })}`,
      ``,
      `💰 *Sales & Revenue:*`,
      `• Today's Revenue: ৳${todayRev.toLocaleString('en-US')} (${todayOrders} orders)`,
      `• Yesterday's Revenue: ৳${yesterdayRev.toLocaleString('en-US')}`,
      ``,
      `📦 *Operations & Courier:*`,
      `• Packing & Dispatch Queue: ${packingQueueCount} orders ready to ship`,
      ``,
      `⚠️ *Inventory Alerts:*`,
      `• Low Stock Variants (≤ 5 units): ${lowStockVariants.length} items`,
      ...lowStockVariants.map((v) => `  - ${v.product.name} (${v.sku || 'SKU'}): ${v.stock} left`),
      ``,
      `⭐ *Customer Reviews:*`,
      `• Pending Unapproved Reviews: ${pendingReviewsCount}`,
      ``,
      `_SPLARO Autonomous AI Store Manager_`,
    ].join('\n')

    if (args.sendToTelegram) {
      try {
        await this.sendTelegram(storeId, briefText)
      } catch (err) {
        this.logger.warn(`Telegram brief delivery failed: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    return {
      todayRevenue: todayRev,
      todayOrders,
      yesterdayRevenue: yesterdayRev,
      packingQueueCount,
      lowStockVariantsCount: lowStockVariants.length,
      pendingReviewsCount,
      briefMarkdown: briefText,
    }
  }
}

