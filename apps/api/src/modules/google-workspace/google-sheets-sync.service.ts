import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { resolvePublicSiteUrl } from '@splaro/config'
import { PrismaService } from '../../common/prisma.service'
import { resolveStoreId } from '../../common/store.util'
import {
  GOOGLE_SHEET_TABS,
  GOOGLE_SYNC_JOB_TYPES,
  STANDARD_ROW_HEADERS,
  type GoogleSheetTab,
} from './google.constants'
import {
  BUSINESS_SHEET_TABS,
  SHEET_HEADERS,
  formatDateBD,
  formatDateTimeBD,
  formatMoneyBDT,
  formatPhoneBD,
  formatPhoneForGoogleSheet,
  type BusinessSheetTab,
} from './google-sheets-bd.util'
import { buildSheetFormatRequests } from './google-sheets-format.service'
import {
  prepareDashboardSheet,
  buildDashboardDesignRequests,
  buildDashboardLayout,
  clearDashboardCharts,
  type DashboardLayout,
} from './google-sheets-dashboard.service'
import {
  buildOrdersPremiumRequests,
  buildProductsPremiumRequests,
} from './google-sheets-premium.service'
import { GoogleClientService } from './google-client.service'
import { GoogleAuditService } from './google-audit.service'

@Injectable()
export class GoogleSheetsSyncService {
  private readonly logger = new Logger(GoogleSheetsSyncService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly client: GoogleClientService,
    private readonly config: ConfigService,
    private readonly audit: GoogleAuditService,
  ) {}

  async getSpreadsheetId(storeId: string) {
    const conn = await this.prisma.googleWorkspaceConnection.findUnique({ where: { storeId } })
    return (
      conn?.spreadsheetId?.trim() ||
      this.config.get<string>('GOOGLE_DEFAULT_SPREADSHEET_ID')?.trim() ||
      null
    )
  }

  async createDefaultSpreadsheet(storeIdRaw: string, userId?: string) {
    const storeId = await resolveStoreId(this.prisma, storeIdRaw)
    const sheets = await this.client.sheets(storeId)
    const store = await this.prisma.store.findUnique({ where: { id: storeId }, select: { name: true } })
    const storeLabel = store?.name ?? 'SPLARO'
    const nowBD = formatDateTimeBD(new Date())

    const res = await sheets.spreadsheets.create({
      requestBody: {
        properties: { title: `SPLARO Business Hub — ${storeLabel}` },
        sheets: BUSINESS_SHEET_TABS.map((title) => ({
          properties: { title, gridProperties: { frozenRowCount: 2 } },
        })),
      },
    })

    const spreadsheetId = res.data.spreadsheetId
    const spreadsheetUrl = res.data.spreadsheetUrl
    if (!spreadsheetId) throw new Error('Google Sheets API did not return spreadsheet ID')

    const sheetIdByTab = new Map<string, number>()
    for (const sheet of res.data.sheets ?? []) {
      const title = sheet.properties?.title
      const sheetId = sheet.properties?.sheetId
      if (title && sheetId != null) sheetIdByTab.set(title, sheetId)
    }

    const counts = await this.populateBusinessSpreadsheet(storeId, spreadsheetId, storeLabel, nowBD)
    await this.applyBusinessFormatting(spreadsheetId, storeId, sheetIdByTab, counts)

    for (const tab of BUSINESS_SHEET_TABS) {
      await this.prisma.googleSheetConfig.upsert({
        where: { storeId_sheetTab: { storeId, sheetTab: tab } },
        create: { storeId, sheetTab: tab, spreadsheetId, enabled: true, createdBy: userId ?? null },
        update: { spreadsheetId, enabled: true, updatedBy: userId ?? null },
      })
    }

    await this.prisma.googleWorkspaceConnection.update({
      where: { storeId },
      data: { spreadsheetId, spreadsheetUrl: spreadsheetUrl ?? null, updatedBy: userId ?? null },
    })

    await this.audit.log({
      storeId,
      action: 'CREATE_SPREADSHEET',
      service: 'sheets',
      resourceId: spreadsheetId,
      message: `Business hub created — ${counts.orders} orders, ${counts.customers} customers, ${counts.subscribers} subscribers, ${counts.productRows} product rows`,
      userId,
    })

    return {
      spreadsheetId,
      spreadsheetUrl,
      tabs: BUSINESS_SHEET_TABS.length,
      ...counts,
    }
  }

  async linkExistingSpreadsheet(storeIdRaw: string, spreadsheetIdRaw: string, userId?: string) {
    const storeId = await resolveStoreId(this.prisma, storeIdRaw)
    const spreadsheetId = spreadsheetIdRaw.trim()
    if (!spreadsheetId) throw new Error('Spreadsheet ID is required')

    const sheets = await this.client.sheets(storeId)
    const store = await this.prisma.store.findUnique({ where: { id: storeId }, select: { name: true } })
    const storeLabel = store?.name ?? 'SPLARO'
    const nowBD = formatDateTimeBD(new Date())
    const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`

    await this.normalizeBusinessTabs(spreadsheetId, storeId)

    const meta2 = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties' })
    const sheetIdByTab = new Map<string, number>()
    for (const sheet of meta2.data.sheets ?? []) {
      const title = sheet.properties?.title
      const sheetId = sheet.properties?.sheetId
      if (title && sheetId != null) sheetIdByTab.set(title, sheetId)
    }

    const counts = await this.populateBusinessSpreadsheet(storeId, spreadsheetId, storeLabel, nowBD)
    await this.applyBusinessFormatting(spreadsheetId, storeId, sheetIdByTab, counts)

    for (const tab of BUSINESS_SHEET_TABS) {
      await this.prisma.googleSheetConfig.upsert({
        where: { storeId_sheetTab: { storeId, sheetTab: tab } },
        create: { storeId, sheetTab: tab, spreadsheetId, enabled: true, createdBy: userId ?? null },
        update: { spreadsheetId, enabled: true, updatedBy: userId ?? null },
      })
    }

    await this.prisma.googleWorkspaceConnection.upsert({
      where: { storeId },
      create: {
        storeId,
        spreadsheetId,
        spreadsheetUrl,
        isConnected: true,
        autoSyncEnabled: true,
        tokenHealth: 'healthy',
        googleEmail: this.config.get<string>('GOOGLE_SERVICE_ACCOUNT_EMAIL') ?? null,
        createdBy: userId ?? null,
      },
      update: { spreadsheetId, spreadsheetUrl, isConnected: true, tokenHealth: 'healthy', lastError: null, updatedBy: userId ?? null },
    })

    await this.audit.log({
      storeId,
      action: 'LINK_SPREADSHEET',
      service: 'sheets',
      resourceId: spreadsheetId,
      message: `Linked existing sheet — ${counts.orders} orders synced`,
      userId,
    })

    return { spreadsheetId, spreadsheetUrl, linked: true, ...counts }
  }

  /** Rename legacy tabs (ORDERS, USERS…) and add any missing business tabs */
  private async normalizeBusinessTabs(spreadsheetId: string, storeId: string) {
    const sheets = await this.client.sheets(storeId)
    const legacyToBusiness: Record<string, BusinessSheetTab> = {
      sheet1: 'Dashboard',
      dashboard: 'Dashboard',
      orders: 'Orders',
      order: 'Orders',
      customers: 'Customers',
      customer: 'Customers',
      users: 'Customers',
      user: 'Customers',
      subscribers: 'Subscribers',
      subscriber: 'Subscribers',
      subscriptions: 'Subscribers',
      subscription: 'Subscribers',
      products: 'Products & Stock',
      product: 'Products & Stock',
      inventory: 'Products & Stock',
      'products & stock': 'Products & Stock',
    }

    const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties' })
    const renameRequests: object[] = []
    const titlesAfterRename = new Set<string>()

    for (const sheet of meta.data.sheets ?? []) {
      const title = sheet.properties?.title ?? ''
      const sheetId = sheet.properties?.sheetId
      if (sheetId == null) continue

      const key = title.trim().toLowerCase()
      const target = legacyToBusiness[key]
      if (target && target !== title) {
        if (!titlesAfterRename.has(target)) {
          renameRequests.push({
            updateSheetProperties: {
              properties: { sheetId, title: target },
              fields: 'title',
            },
          })
          titlesAfterRename.add(target)
        }
      } else {
        titlesAfterRename.add(title)
      }
    }

    if (renameRequests.length) {
      await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: renameRequests } })
    }

    const meta2 = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties' })
    const existingTabs = new Set((meta2.data.sheets ?? []).map((s) => s.properties?.title).filter(Boolean) as string[])
    const missingTabs = BUSINESS_SHEET_TABS.filter((t) => !existingTabs.has(t))

    if (missingTabs.length) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: missingTabs.map((title) => ({
            addSheet: { properties: { title, gridProperties: { frozenRowCount: 2 } } },
          })),
        },
      })
    }
  }

  private async isBusinessHub(storeId: string) {
    const cfg = await this.prisma.googleSheetConfig.findFirst({
      where: { storeId, sheetTab: 'Products & Stock' },
    })
    return Boolean(cfg)
  }

  private async populateBusinessSpreadsheet(
    storeId: string,
    spreadsheetId: string,
    storeLabel: string,
    nowBD: string,
  ) {
    const sheets = await this.client.sheets(storeId)

    const [orders, customers, subscribers, products] = await Promise.all([
      this.prisma.order.findMany({
        where: { storeId },
        include: { customer: true, items: true },
        orderBy: { createdAt: 'desc' },
        take: 5000,
      }),
      this.prisma.customer.findMany({ where: { storeId }, orderBy: { createdAt: 'desc' }, take: 5000 }),
      this.prisma.newsletterSubscriber.findMany({ where: { storeId }, orderBy: { createdAt: 'desc' }, take: 5000 }),
      this.prisma.product.findMany({
        where: { storeId },
        include: { variants: true },
        orderBy: { updatedAt: 'desc' },
        take: 2000,
      }),
    ])

    const orderRows = orders.map((order) => {
      const productLines = order.items
        .map((item) => `${item.productName}${item.variantName ? ` (${item.variantName})` : ''} ×${item.quantity}`)
        .join(' · ')
      const totalQty = order.items.reduce((sum, item) => sum + item.quantity, 0)
      const email =
        order.shippingEmail?.trim() ||
        order.customer?.email?.trim() ||
        '—'

      return [
        order.invoiceNumber,
        formatDateTimeBD(order.createdAt),
        order.shippingName,
        formatPhoneBD(order.shippingPhone),
        email.includes('@') ? email : '—',
        order.status,
        order.paymentStatus,
        order.paymentMethod,
        formatMoneyBDT(order.subtotal),
        formatMoneyBDT(order.deliveryCharge),
        formatMoneyBDT(order.discount),
        formatMoneyBDT(order.total),
        order.shippingCity,
        order.shippingDistrict,
        order.shippingDivision,
        productLines || '—',
        totalQty,
        order.notes ?? '—',
      ]
    })

    const customerRows = customers.map((c) => [
      c.id,
      formatDateTimeBD(c.createdAt),
      `${c.firstName} ${c.lastName}`.trim(),
      formatPhoneForGoogleSheet(c.phone),
      c.email ?? '—',
      c.totalOrders,
      formatMoneyBDT(c.totalSpent),
      c.loyaltyTier,
      c.loyaltyPoints,
      formatDateTimeBD(c.lastOrderDate),
      c.acceptMarketing ? 'Yes' : 'No',
      c.tags.length ? c.tags.join(', ') : '—',
    ])

    const subscriberRows = subscribers.map((s) => [
      s.email,
      s.status,
      s.source,
      formatDateTimeBD(s.createdAt),
      formatDateTimeBD(s.updatedAt),
      s.id,
    ])

    const productRows: (string | number)[][] = []
    const storefrontUrl = resolvePublicSiteUrl()
    let totalStock = 0
    const stockByProduct = new Map<string, { name: string; stock: number }>()
    for (const product of products) {
      let productStock = 0
      const variants = product.variants.length
        ? product.variants
        : [
            {
              id: '—',
              sku: product.sku,
              size: '—',
              color: null,
              colorName: null,
              stock: 0,
              reservedStock: 0,
              updatedAt: product.updatedAt,
            },
          ]
      for (const v of variants) {
        const stock = v.stock ?? 0
        const reserved = v.reservedStock ?? 0
        totalStock += stock
        productStock += stock
        productRows.push([
          product.name,
          v.sku ?? product.sku ?? '—',
          product.slug,
          product.status,
          formatMoneyBDT(product.basePrice),
          v.size ?? '—',
          v.color ?? v.colorName ?? '—',
          stock,
          reserved,
          stock - reserved,
          product.isPublished ? 'Yes' : 'No',
          product.isFeatured ? 'Yes' : 'No',
          formatDateTimeBD(v.updatedAt ?? product.updatedAt),
          product.id,
          v.id,
          `=HYPERLINK("${storefrontUrl}/products/${product.slug.replace(/"/g, '""')}","View Product")`,
        ])
      }
      stockByProduct.set(product.id, { name: product.name, stock: productStock })
    }

    const productSales = new Map<string, { sold: number; revenue: number }>()
    for (const order of orders) {
      for (const item of order.items) {
        const pid = item.productId
        const row = productSales.get(pid) ?? { sold: 0, revenue: 0 }
        row.sold += item.quantity
        row.revenue += Number(item.subtotal)
        productSales.set(pid, row)
      }
    }

    const topProductsDetailed = [...stockByProduct.entries()]
      .map(([id, { name, stock }]) => {
        const sales = productSales.get(id) ?? { sold: 0, revenue: 0 }
        const status = stock <= 5 ? 'Low Stock' : stock >= 10 ? 'Healthy' : 'Monitor'
        return { name, stock, sold: sales.sold, revenue: formatMoneyBDT(sales.revenue), status }
      })
      .sort((a, b) => b.stock - a.stock)

    const totalRevenue = orders.reduce((sum, o) => sum + Number(o.total), 0)
    const courierTotal = orders.reduce((sum, o) => sum + Number(o.deliveryCharge), 0)
    const marketingTotal = 0
    const expensesTotal = courierTotal + marketingTotal
    const profitTotal = totalRevenue - expensesTotal

    const orderStatusMap = new Map<string, number>()
    const paymentStatusMap = new Map<string, number>()
    for (const o of orders) {
      orderStatusMap.set(o.status, (orderStatusMap.get(o.status) ?? 0) + 1)
      paymentStatusMap.set(o.paymentStatus, (paymentStatusMap.get(o.paymentStatus) ?? 0) + 1)
    }

    const pendingOrders = orderStatusMap.get('PENDING') ?? 0
    const deliveredOrders = orderStatusMap.get('DELIVERED') ?? 0
    const returnedOrders = orderStatusMap.get('RETURNED') ?? 0
    const returnRate = orders.length ? `${((returnedOrders / orders.length) * 100).toFixed(1)}%` : '0%'
    const conversionRate = customers.length
      ? `${((orders.length / customers.length) * 100).toFixed(1)}%`
      : '—'

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const newCustomers = customers.filter((c) => c.createdAt >= thirtyDaysAgo).length
    const repeatCustomers = customers.filter((c) => c.totalOrders > 1).length
    const topCustomer = [...customers].sort((a, b) => Number(b.totalSpent) - Number(a.totalSpent))[0]
    const topCustomerName = topCustomer ? `${topCustomer.firstName} ${topCustomer.lastName}`.trim() : '—'

    const monthFmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Dhaka',
      month: 'short',
      year: '2-digit',
    })
    const monthlyBuckets = new Map<string, { orders: number; revenue: number; customers: number }>()
    for (let i = 5; i >= 0; i--) {
      const d = new Date()
      d.setDate(1)
      d.setMonth(d.getMonth() - i)
      monthlyBuckets.set(monthFmt.format(d), { orders: 0, revenue: 0, customers: 0 })
    }
    for (const o of orders) {
      const key = monthFmt.format(o.createdAt)
      const bucket = monthlyBuckets.get(key)
      if (bucket) {
        bucket.orders += 1
        bucket.revenue += Number(o.total)
      }
    }
    for (const customer of customers) {
      const bucket = monthlyBuckets.get(monthFmt.format(customer.createdAt))
      if (bucket) bucket.customers += 1
    }
    const monthlyTrend = [...monthlyBuckets.entries()].map(([month, v]) => ({
      month,
      orders: v.orders,
      revenue: v.revenue,
      customers: v.customers,
    }))

    const conn = await this.prisma.googleWorkspaceConnection.findUnique({ where: { storeId } })
    const googleConnected = this.config.get<string>('GOOGLE_SERVICE_ACCOUNT_ENABLED') === 'true'

    const dashboardLayout = buildDashboardLayout({
      storeLabel,
      nowBD,
      todayDate: formatDateBD(new Date()),
      storeStatus: 'Active',
      googleConnected,
      orders: orders.length,
      revenue: formatMoneyBDT(totalRevenue),
      customers: customers.length,
      products: products.length,
      subscribers: subscribers.length,
      delivered: deliveredOrders,
      pending: pendingOrders,
      returnRate,
      conversionRate,
      newCustomers,
      repeatCustomers,
      topCustomerName,
      financeRevenue: formatMoneyBDT(totalRevenue),
      financeExpenses: formatMoneyBDT(expensesTotal),
      financeProfit: formatMoneyBDT(profitTotal),
      partnerShare: '—',
      courierCost: formatMoneyBDT(courierTotal),
      marketingCost: formatMoneyBDT(marketingTotal),
      topProducts: topProductsDetailed,
      monthlyTrend,
      integrations: [
        { name: 'Telegram', connected: Boolean(this.config.get('TELEGRAM_BOT_TOKEN')), lastSync: nowBD },
        { name: 'Google Sheets', connected: googleConnected, lastSync: nowBD },
        {
          name: 'Gmail',
          connected: Boolean(conn?.googleEmail),
          lastSync: conn?.updatedAt ? formatDateTimeBD(conn.updatedAt) : '—',
        },
        { name: 'OpenAI', connected: Boolean(this.config.get('OPENAI_API_KEY')), lastSync: '—' },
        {
          name: 'Courier APIs',
          connected: Boolean(this.config.get('STEADFAST_API_KEY')),
          lastSync: nowBD,
        },
        { name: 'Payment Gateways', connected: true, lastSync: nowBD },
      ],
      recentOrders: orders.slice(0, 5).map((o) => ({
        invoice: o.invoiceNumber,
        customer: o.shippingName,
        total: formatMoneyBDT(o.total),
        status: o.status,
        date: formatDateTimeBD(o.createdAt),
      })),
      recentCustomers: customers.slice(0, 5).map((c) => ({
        name: `${c.firstName} ${c.lastName}`.trim(),
        phone: c.phone,
        orders: c.totalOrders,
        spent: formatMoneyBDT(c.totalSpent),
      })),
      orderStatusCounts: Array.from(orderStatusMap.entries()).map(([status, count]) => ({ status, count })),
    })

    const dashboardValues = dashboardLayout.values

    const titleRow = (tab: BusinessSheetTab): string[] => {
      const cols = SHEET_HEADERS[tab].length
      const row = Array.from({ length: cols }, () => '')
      row[0] = `SPLARO PREMIUM · ${storeLabel} · ${tab}`
      return row
    }

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data: [
          {
            range: `'Dashboard'!A1`,
            values: dashboardValues,
          },
          {
            range: `'Orders'!A1`,
            values: [titleRow('Orders'), [...SHEET_HEADERS.Orders], ...orderRows],
          },
          {
            range: `'Customers'!A1`,
            values: [titleRow('Customers'), [...SHEET_HEADERS.Customers], ...customerRows],
          },
          {
            range: `'Subscribers'!A1`,
            values: [titleRow('Subscribers'), [...SHEET_HEADERS.Subscribers], ...subscriberRows],
          },
          {
            range: `'Products & Stock'!A1`,
            values: [titleRow('Products & Stock'), [...SHEET_HEADERS['Products & Stock']], ...productRows],
          },
        ],
      },
    })

    return {
      orders: orders.length,
      customers: customers.length,
      subscribers: subscribers.length,
      products: products.length,
      productRows: productRows.length,
      totalStock,
      dashboardLayout,
      dashboardRowCount: dashboardValues.length,
    }
  }

  private async applyBusinessFormatting(
    spreadsheetId: string,
    storeId: string,
    sheetIdByTab: Map<string, number>,
    counts: {
      orders: number
      customers: number
      subscribers: number
      productRows: number
      dashboardLayout: DashboardLayout
      dashboardRowCount: number
    },
  ) {
    const sheets = await this.client.sheets(storeId)
    const rowCounts: Record<BusinessSheetTab, number> = {
      Dashboard: counts.dashboardRowCount,
      Orders: counts.orders + 2,
      Customers: counts.customers + 2,
      Subscribers: counts.subscribers + 2,
      'Products & Stock': counts.productRows + 2,
    }

    const requests: object[] = []

    const dashboardSheetId = sheetIdByTab.get('Dashboard')
    if (dashboardSheetId != null) {
      await prepareDashboardSheet(sheets, spreadsheetId, dashboardSheetId, counts.dashboardRowCount)
      requests.push(...buildDashboardDesignRequests(dashboardSheetId, counts.dashboardLayout))
    }

    const ordersSheetId = sheetIdByTab.get('Orders')
    if (ordersSheetId != null && counts.orders > 0) {
      requests.push(...buildOrdersPremiumRequests(ordersSheetId, 2, rowCounts.Orders))
    }

    const productsSheetId = sheetIdByTab.get('Products & Stock')
    if (productsSheetId != null && counts.productRows > 0) {
      requests.push(...buildProductsPremiumRequests(productsSheetId, 2, rowCounts['Products & Stock']))
    }

    for (const tab of BUSINESS_SHEET_TABS) {
      if (tab === 'Dashboard') continue
      const sheetId = sheetIdByTab.get(tab)
      if (sheetId == null) continue
      const colCount = SHEET_HEADERS[tab].length
      const dataRows = rowCounts[tab]
      requests.push(
        {
          mergeCells: {
            range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: colCount },
            mergeType: 'MERGE_ALL',
          },
        },
        {
          repeatCell: {
            range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: colCount },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.067, green: 0.067, blue: 0.067 },
                textFormat: { foregroundColor: { red: 0.784, green: 0.663, blue: 0.494 }, bold: true, fontSize: 13 },
                horizontalAlignment: 'CENTER',
                verticalAlignment: 'MIDDLE',
              },
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)',
          },
        },
        {
          updateDimensionProperties: {
            range: { sheetId, dimension: 'ROWS', startIndex: 0, endIndex: 1 },
            properties: { pixelSize: 42 },
            fields: 'pixelSize',
          },
        },
        ...buildSheetFormatRequests(sheetId, colCount, dataRows).map((req) => {
          if (req.repeatCell?.range?.startRowIndex === 0) {
            return {
              ...req,
              repeatCell: {
                ...req.repeatCell,
                range: { ...req.repeatCell.range, startRowIndex: 1, endRowIndex: 2 },
              },
            }
          }
          if (req.updateSheetProperties) {
            return {
              ...req,
              updateSheetProperties: {
                ...req.updateSheetProperties,
                properties: {
                  ...req.updateSheetProperties.properties,
                  gridProperties: { frozenRowCount: 2 },
                },
              },
            }
          }
          if (req.setBasicFilter?.filter?.range) {
            return {
              ...req,
              setBasicFilter: {
                filter: {
                  range: { ...req.setBasicFilter.filter.range, startRowIndex: 1 },
                },
              },
            }
          }
          if (req.repeatCell?.range?.startRowIndex != null && req.repeatCell.range.startRowIndex >= 1) {
            const start = req.repeatCell.range.startRowIndex + 1
            return {
              ...req,
              repeatCell: {
                ...req.repeatCell,
                range: { ...req.repeatCell.range, startRowIndex: start, endRowIndex: start + 1 },
              },
            }
          }
          return req
        }),
        {
          autoResizeDimensions: {
            dimensions: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: colCount },
          },
        },
      )
    }

    await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } })
  }

  private async refreshDashboardCharts(
    spreadsheetId: string,
    storeId: string,
    sheetIdByTab: Map<string, number>,
    counts: {
      dashboardLayout: DashboardLayout
    },
  ) {
    const sheets = await this.client.sheets(storeId)
    const dashboardSheetId = sheetIdByTab.get('Dashboard')
    if (dashboardSheetId == null) return

    await clearDashboardCharts(sheets, spreadsheetId)
    const chartRequests = buildDashboardDesignRequests(dashboardSheetId, counts.dashboardLayout).filter(
      (r) => r.addChart,
    )

    if (chartRequests.length) {
      await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: chartRequests } })
    }

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'Dashboard'!A2`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[`🟢 LIVE SYNC  ·  ${formatDateTimeBD(new Date())}  ·  Asia/Dhaka (BD)`, ...Array(15).fill('')]],
      },
    })
  }

  async refreshBusinessSpreadsheet(storeIdRaw: string, userId?: string) {
    const storeId = await resolveStoreId(this.prisma, storeIdRaw)
    const spreadsheetId = await this.getSpreadsheetId(storeId)
    if (!spreadsheetId) throw new Error('No spreadsheet configured. Create business hub spreadsheet first.')

    const store = await this.prisma.store.findUnique({ where: { id: storeId }, select: { name: true } })
    const nowBD = formatDateTimeBD(new Date())
    const sheets = await this.client.sheets(storeId)
    const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties' })
    const sheetIdByTab = new Map<string, number>()
    for (const sheet of meta.data.sheets ?? []) {
      const title = sheet.properties?.title
      const sheetId = sheet.properties?.sheetId
      if (title && sheetId != null) sheetIdByTab.set(title, sheetId)
    }

    const counts = await this.populateBusinessSpreadsheet(
      storeId,
      spreadsheetId,
      store?.name ?? 'SPLARO',
      nowBD,
    )
    await this.applyBusinessFormatting(spreadsheetId, storeId, sheetIdByTab, counts)

    await this.prisma.googleWorkspaceConnection.update({
      where: { storeId },
      data: { lastSyncAt: new Date(), lastError: null, updatedBy: userId ?? null },
    })

    return { spreadsheetId, ...counts, refreshedAt: nowBD }
  }

  private async appendRow(
    storeId: string,
    tab: GoogleSheetTab,
    values: (string | number | null)[],
    meta: { resourceType?: string; resourceId?: string; jobType: string; triggeredBy?: string },
  ) {
    const spreadsheetId = await this.getSpreadsheetId(storeId)
    if (!spreadsheetId) throw new Error('No spreadsheet configured. Create default spreadsheet first.')

    const sheets = await this.client.sheets(storeId)
    const res = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `'${tab}'!A:Z`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [values] },
    })

    const updatedRange = res.data.updates?.updatedRange ?? ''
    const rowMatch = updatedRange.match(/!A(\d+)/)
    const rowNumber = rowMatch ? parseInt(rowMatch[1], 10) : null

    await this.prisma.googleSyncLog.create({
      data: {
        storeId,
        jobType: meta.jobType,
        resourceType: meta.resourceType ?? null,
        resourceId: meta.resourceId ?? null,
        sheetTab: tab,
        rowNumber,
        status: 'success',
        syncedAt: new Date(),
        source: 'splaro',
        triggeredBy: meta.triggeredBy ?? null,
      },
    })

    await this.prisma.googleWorkspaceConnection.update({
      where: { storeId },
      data: { lastSyncAt: new Date(), lastError: null },
    })

    return { rowNumber, spreadsheetId, tab }
  }

  private baseRow(storeId: string, id: string, status: string, createdBy?: string | null, notes?: string) {
    return [
      id,
      new Date().toISOString(),
      storeId,
      status,
      createdBy ?? 'system',
      new Date().toISOString(),
      'splaro',
      notes ?? '',
    ]
  }

  async syncOrder(storeIdRaw: string, orderId: string, triggeredBy?: string) {
    const storeId = await resolveStoreId(this.prisma, storeIdRaw)
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, storeId },
      include: { customer: true, items: true },
    })
    if (!order) throw new Error(`Order ${orderId} not found`)

    if (await this.isBusinessHub(storeId)) {
      return this.refreshBusinessSpreadsheet(storeIdRaw, triggeredBy)
    }

    const orderRow = [
      ...this.baseRow(storeId, order.id, order.status, order.customerId, order.invoiceNumber ?? ''),
      JSON.stringify({
        invoice: order.invoiceNumber,
        total: Number(order.total),
        items: order.items.length,
        customer: order.customer?.email ?? order.shippingPhone,
      }),
    ]

    const result = await this.appendRow(storeId, 'Orders', orderRow, {
      resourceType: 'order',
      resourceId: order.id,
      jobType: GOOGLE_SYNC_JOB_TYPES.ORDER,
      triggeredBy,
    })

    if (order.customerId) {
      await this.syncCustomer(storeId, order.customerId, triggeredBy).catch((e) =>
        this.logger.warn(`Customer sync after order failed: ${e}`),
      )
    }

    return result
  }

  async syncCustomer(storeIdRaw: string, customerId: string, triggeredBy?: string) {
    const storeId = await resolveStoreId(this.prisma, storeIdRaw)
    const customer = await this.prisma.customer.findFirst({ where: { id: customerId, storeId } })
    if (!customer) throw new Error(`Customer ${customerId} not found`)

    if (await this.isBusinessHub(storeId)) {
      return this.refreshBusinessSpreadsheet(storeIdRaw, triggeredBy)
    }

    const row = [
      ...this.baseRow(storeId, customer.id, 'active', undefined, customer.email ?? ''),
      JSON.stringify({ name: `${customer.firstName ?? ''} ${customer.lastName ?? ''}`.trim(), phone: customer.phone }),
    ]

    return this.appendRow(storeId, 'Customers', row, {
      resourceType: 'customer',
      resourceId: customer.id,
      jobType: GOOGLE_SYNC_JOB_TYPES.CUSTOMER,
      triggeredBy,
    })
  }

  async syncProduct(storeIdRaw: string, productId: string, triggeredBy?: string) {
    const storeId = await resolveStoreId(this.prisma, storeIdRaw)
    if (await this.isBusinessHub(storeId)) {
      await this.refreshBusinessSpreadsheet(storeIdRaw, triggeredBy)
      return { refreshed: true, productId }
    }

    const product = await this.prisma.product.findFirst({
      where: { id: productId, storeId },
      include: { variants: true },
    })
    if (!product) throw new Error(`Product ${productId} not found`)

    const row = [
      ...this.baseRow(storeId, product.id, product.status, null, product.slug),
      JSON.stringify({ name: product.name, price: Number(product.basePrice), variants: product.variants.length }),
    ]

    await this.appendRow(storeId, 'Products', row, {
      resourceType: 'product',
      resourceId: product.id,
      jobType: GOOGLE_SYNC_JOB_TYPES.PRODUCT,
      triggeredBy,
    })

    const stock = product.variants.reduce((s, v) => s + (v.stock ?? 0), 0)
    const invRow = [
      ...this.baseRow(storeId, product.id, 'inventory', null, product.slug),
      JSON.stringify({ stock, sku: product.variants[0]?.sku ?? '' }),
    ]
    return this.appendRow(storeId, 'Inventory', invRow, {
      resourceType: 'product',
      resourceId: product.id,
      jobType: GOOGLE_SYNC_JOB_TYPES.INVENTORY,
      triggeredBy,
    })
  }

  async syncSubscriber(storeIdRaw: string, subscriberId: string, triggeredBy?: string) {
    const storeId = await resolveStoreId(this.prisma, storeIdRaw)
    const sub = await this.prisma.newsletterSubscriber.findFirst({ where: { id: subscriberId, storeId } })
    if (!sub) throw new Error(`Subscriber ${subscriberId} not found`)

    if (await this.isBusinessHub(storeId)) {
      return this.refreshBusinessSpreadsheet(storeIdRaw, triggeredBy)
    }

    const row = [
      ...this.baseRow(storeId, sub.id, sub.status, null, sub.email),
      JSON.stringify({ source: sub.source }),
    ]

    return this.appendRow(storeId, 'Subscribers', row, {
      resourceType: 'subscriber',
      resourceId: sub.id,
      jobType: GOOGLE_SYNC_JOB_TYPES.SUBSCRIBER,
      triggeredBy,
    })
  }

  async fullBackup(storeIdRaw: string, triggeredBy?: string) {
    const storeId = await resolveStoreId(this.prisma, storeIdRaw)
    if (await this.isBusinessHub(storeId)) {
      return this.refreshBusinessSpreadsheet(storeIdRaw, triggeredBy)
    }

    const [orders, customers, products] = await Promise.all([
      this.prisma.order.findMany({ where: { storeId }, take: 500, orderBy: { createdAt: 'desc' } }),
      this.prisma.customer.findMany({ where: { storeId }, take: 500, orderBy: { createdAt: 'desc' } }),
      this.prisma.product.findMany({ where: { storeId }, take: 500, orderBy: { updatedAt: 'desc' } }),
    ])

    let synced = 0
    for (const o of orders) {
      await this.syncOrder(storeId, o.id, triggeredBy)
      synced++
    }
    for (const c of customers) {
      await this.syncCustomer(storeId, c.id, triggeredBy)
      synced++
    }
    for (const p of products) {
      await this.syncProduct(storeId, p.id, triggeredBy)
      synced++
    }

    return { synced, orders: orders.length, customers: customers.length, products: products.length }
  }

  private async appendBusinessRow(
    storeId: string,
    tab: BusinessSheetTab,
    values: (string | number | null)[],
    meta: { resourceType?: string; resourceId?: string; jobType: string; triggeredBy?: string },
  ) {
    const spreadsheetId = await this.getSpreadsheetId(storeId)
    if (!spreadsheetId) throw new Error('No spreadsheet configured. Create business hub spreadsheet first.')

    const sheets = await this.client.sheets(storeId)
    const res = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `'${tab}'!A:Z`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [values] },
    })

    const updatedRange = res.data.updates?.updatedRange ?? ''
    const rowMatch = updatedRange.match(/!A(\d+)/)
    const rowNumber = rowMatch ? parseInt(rowMatch[1], 10) : null

    await this.prisma.googleSyncLog.create({
      data: {
        storeId,
        jobType: meta.jobType,
        resourceType: meta.resourceType ?? null,
        resourceId: meta.resourceId ?? null,
        sheetTab: tab,
        rowNumber,
        status: 'success',
        syncedAt: new Date(),
        source: 'splaro',
        triggeredBy: meta.triggeredBy ?? null,
      },
    })

    await this.prisma.googleWorkspaceConnection.update({
      where: { storeId },
      data: { lastSyncAt: new Date(), lastError: null },
    })

    return { rowNumber, spreadsheetId, tab }
  }

  async getSheetConfigs(storeIdRaw: string) {
    const storeId = await resolveStoreId(this.prisma, storeIdRaw)
    const configs = await this.prisma.googleSheetConfig.findMany({ where: { storeId }, orderBy: { sheetTab: 'asc' } })
    const spreadsheetId = await this.getSpreadsheetId(storeId)
    const conn = await this.prisma.googleWorkspaceConnection.findUnique({ where: { storeId } })
    const businessHub = await this.isBusinessHub(storeId)
    return {
      spreadsheetId,
      spreadsheetUrl: conn?.spreadsheetUrl ?? (spreadsheetId ? `https://docs.google.com/spreadsheets/d/${spreadsheetId}` : null),
      autoSyncEnabled: conn?.autoSyncEnabled ?? true,
      tabs: configs,
      allTabs: businessHub ? [...BUSINESS_SHEET_TABS] : [...GOOGLE_SHEET_TABS],
      businessHub,
    }
  }

  async toggleAutoSync(storeIdRaw: string, enabled: boolean, userId?: string) {
    const storeId = await resolveStoreId(this.prisma, storeIdRaw)
    await this.prisma.googleWorkspaceConnection.update({
      where: { storeId },
      data: { autoSyncEnabled: enabled, updatedBy: userId ?? null },
    })
    return { autoSyncEnabled: enabled }
  }
}
