import type { sheets_v4 } from 'googleapis'

type Rgb = { red: number; green: number; blue: number }

function hex(h: string): Rgb {
  const n = h.replace('#', '')
  return {
    red: parseInt(n.slice(0, 2), 16) / 255,
    green: parseInt(n.slice(2, 4), 16) / 255,
    blue: parseInt(n.slice(4, 6), 16) / 255,
  }
}

/** SPLARO luxury palette */
export const SPLARO = {
  primary: hex('#111111'),
  bg: hex('#FAF8F5'),
  accent: hex('#C8A97E'),
  success: hex('#22C55E'),
  danger: hex('#EF4444'),
  muted: hex('#6B7280'),
  white: { red: 1, green: 1, blue: 1 } as Rgb,
  border: hex('#E8E4DF'),
  card: { red: 1, green: 1, blue: 1 } as Rgb,
}

export const DASH_COLS = 20
const DATA_ROW_START = 92
const FONT = 'Roboto'

export interface DashboardProductRow {
  name: string
  stock: number
  sold: number
  revenue: string
  status: string
}

export interface DashboardRecentOrder {
  invoice: string
  customer: string
  total: string
  status: string
  date: string
}

export interface DashboardRecentCustomer {
  name: string
  phone: string
  orders: number
  spent: string
}

export interface DashboardIntegration {
  name: string
  connected: boolean
  lastSync: string
}

export interface DashboardMetrics {
  storeLabel: string
  nowBD: string
  todayDate: string
  storeStatus: string
  googleConnected: boolean
  orders: number
  revenue: string
  customers: number
  products: number
  subscribers: number
  delivered: number
  pending: number
  returnRate: string
  conversionRate: string
  newCustomers: number
  repeatCustomers: number
  topCustomerName: string
  financeRevenue: string
  financeExpenses: string
  financeProfit: string
  partnerShare: string
  courierCost: string
  marketingCost: string
  topProducts: DashboardProductRow[]
  monthlyTrend: Array<{ month: string; orders: number; revenue: number }>
  integrations: DashboardIntegration[]
  recentOrders: DashboardRecentOrder[]
  recentCustomers: DashboardRecentCustomer[]
  orderStatusCounts: Array<{ status: string; count: number }>
}

export interface DashboardLayout {
  values: (string | number)[][]
  chartData: {
    trendStart: number
    trendEnd: number
    customerStart: number
    customerEnd: number
    productStart: number
    productEnd: number
    categoryStart: number
    categoryEnd: number
  }
  topProductTableStart: number
  topProductTableEnd: number
  customerTitleRow: number
  customerDataRow: number
  financeTitleRow: number
  financeDataRow: number
  systemTitleRow: number
  systemHeaderRow: number
  systemDataStart: number
  systemDataEnd: number
  activityTitleRow: number
  activityHeaderRow: number
  activityDataStart: number
  activityDataEnd: number
  stockStatusCol: number
}

function trendLabel(label: string, trend: Array<{ orders: number; revenue: number }>, field: 'orders' | 'revenue'): string {
  if (trend.length < 2) return label
  const cur = trend[trend.length - 1][field]
  const prev = trend[trend.length - 2][field]
  if (prev === 0) return cur > 0 ? `${label} · ↑ new` : label
  const pct = Math.round(((cur - prev) / prev) * 100)
  if (pct === 0) return label
  return pct > 0 ? `${label} · ↑${pct}%` : `${label} · ↓${Math.abs(pct)}%`
}

function blankRow(): (string | number)[] {
  return Array(DASH_COLS).fill('')
}

function pad(cells: (string | number)[]): (string | number)[] {
  const row = blankRow()
  cells.forEach((v, i) => {
    row[i] = v
  })
  return row
}

export function buildDashboardLayout(m: DashboardMetrics): DashboardLayout {
  const topP = m.topProducts.slice(0, 5)
  while (topP.length < 5) {
    topP.push({ name: '—', stock: 0, sold: 0, revenue: '৳0', status: '—' })
  }

  const trend = m.monthlyTrend.length ? m.monthlyTrend : [{ month: '—', orders: 0, revenue: 0 }]

  const values: (string | number)[][] = []

  // ── HEADER ──
  values.push(pad(['SPLARO Business Intelligence', '', '', '', '', '', '', '', '', '', '', '', '', `Today · ${m.todayDate}`]))
  values.push(
    pad([
      m.googleConnected ? '● Live Sync' : '○ Offline',
      '',
      `Last Sync · ${m.nowBD}`,
      '',
      '',
      m.googleConnected ? '● Google Connected' : '○ Google Disconnected',
      '',
      '',
      `Store · ${m.storeStatus}`,
      '',
      '',
      '',
      '',
      '',
      '',
    ]),
  )
  values.push(blankRow()) // gold divider row

  // ── KPI ROW 1 labels + values ──
  values.push(
    pad([
      trendLabel('Total Orders', m.monthlyTrend, 'orders'),
      '',
      '',
      '',
      trendLabel('Revenue (BDT)', m.monthlyTrend, 'revenue'),
      '',
      '',
      '',
      'Customers',
      '',
      '',
      '',
      'Products',
      '',
      '',
      '',
    ]),
  )
  values.push(pad([m.orders, '', '', '', m.revenue, '', '', '', m.customers, '', '', '', m.products, '', '', '']))
  values.push(blankRow())
  values.push(
    pad(['Delivered', '', '', '', 'Pending', '', '', '', 'Return Rate', '', '', '', 'Conversion', '', '', '']),
  )
  values.push(
    pad([m.delivered, '', '', '', m.pending, '', '', '', m.returnRate, '', '', '', m.conversionRate, '', '', '']),
  )
  values.push(blankRow())

  // ── ANALYTICS title ──
  values.push(pad(['Analytics', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '']))
  values.push(...Array(14).fill(null).map(() => blankRow()))

  // ── TOP PRODUCTS TABLE ──
  const topProductTableStart = values.length
  values.push(pad(['Top Products', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '']))
  values.push(pad(['Product', 'Stock', 'Sold', 'Revenue', 'Status', '', '', '', '', '', '', '', '', '', '', '']))
  for (const p of topP) {
    values.push(pad([p.name, p.stock, p.sold, p.revenue, p.status]))
  }
  const topProductTableEnd = values.length

  values.push(blankRow())

  // ── CUSTOMER ──
  const customerTitleRow = values.length
  values.push(pad(['Customer Intelligence', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '']))
  const customerDataRow = values.length
  values.push(
    pad([
      'Total Customers',
      m.customers,
      'New (30d)',
      m.newCustomers,
      'Subscribers',
      m.subscribers,
      'Repeat',
      m.repeatCustomers,
      'Top Customer',
      m.topCustomerName,
      '',
      '',
      '',
      '',
      '',
      '',
    ]),
  )
  values.push(blankRow())

  // ── FINANCE ──
  const financeTitleRow = values.length
  values.push(pad(['Finance Overview', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '']))
  const financeDataRow = values.length
  values.push(
    pad([
      'Revenue',
      m.financeRevenue,
      'Expenses',
      m.financeExpenses,
      'Profit',
      m.financeProfit,
      'Partner Share',
      m.partnerShare,
      'Courier',
      m.courierCost,
      'Marketing',
      m.marketingCost,
      '',
      '',
      '',
      '',
    ]),
  )
  values.push(blankRow())

  // ── SYSTEM STATUS ──
  const systemTitleRow = values.length
  values.push(pad(['Connected Services', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '']))
  const systemHeaderRow = values.length
  values.push(pad(['Service', 'Status', 'Last Sync', '', '', '', '', '', '', '', '', '', '', '', '', '']))
  const systemDataStart = values.length
  for (const svc of m.integrations) {
    values.push(pad([svc.name, svc.connected ? '● Connected' : '○ Disconnected', svc.lastSync]))
  }
  const systemDataEnd = values.length
  values.push(blankRow())

  // ── RECENT ACTIVITY ──
  const activityTitleRow = values.length
  values.push(pad(['Recent Activity', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '']))
  values.push(pad(['Latest Orders', '', '', '', 'Latest Customers', '', '', '', '', '', '', '', '', '', '', '']))
  const activityHeaderRow = values.length
  values.push(pad(['Invoice', 'Customer', 'Total', 'Status', 'Name', 'Phone', 'Orders', 'Spent', '', '', '', '', '', '', '', '']))
  const activityDataStart = values.length
  const activityRows = Math.max(m.recentOrders.length, m.recentCustomers.length, 3)
  for (let i = 0; i < activityRows; i++) {
    const o = m.recentOrders[i]
    const c = m.recentCustomers[i]
    values.push(
      pad([
        o?.invoice ?? '',
        o?.customer ?? '',
        o?.total ?? '',
        o?.status ?? '',
        c?.name ?? '',
        c?.phone ?? '',
        c?.orders ?? '',
        c?.spent ?? '',
      ]),
    )
  }
  const activityDataEnd = values.length

  // ── HIDDEN CHART DATA ──
  while (values.length < DATA_ROW_START) values.push(blankRow())

  const trendStart = values.length + 1
  values.push(pad(['Month', 'Orders', 'Revenue (BDT)']))
  for (const t of trend) {
    values.push(pad([t.month, t.orders, t.revenue]))
  }
  const trendEnd = values.length

  values.push(blankRow())
  const customerStart = values.length + 1
  values.push(pad(['Month', 'New Customers']))
  for (const t of trend) {
    values.push(pad([t.month, Math.round(t.orders * 0.3)]))
  }
  const customerEnd = values.length

  values.push(blankRow())
  const productStart = values.length + 1
  values.push(pad(['Product', 'Stock']))
  for (const p of topP) {
    values.push(pad([p.name, p.stock]))
  }
  const productEnd = values.length

  values.push(blankRow())
  const categoryStart = values.length + 1
  values.push(pad(['Category', 'Products']))
  values.push(pad(['Catalog', m.products]))
  values.push(pad(['In Stock', topP.filter((p) => p.stock > 0).length]))
  const categoryEnd = values.length

  return {
    values,
    chartData: { trendStart, trendEnd, customerStart, customerEnd, productStart, productEnd, categoryStart, categoryEnd },
    topProductTableStart,
    topProductTableEnd,
    customerTitleRow,
    customerDataRow,
    financeTitleRow,
    financeDataRow,
    systemTitleRow,
    systemHeaderRow,
    systemDataStart,
    systemDataEnd,
    activityTitleRow,
    activityHeaderRow,
    activityDataStart,
    activityDataEnd,
    stockStatusCol: 1,
  }
}

function merge(sheetId: number, r1: number, c1: number, r2: number, c2: number): sheets_v4.Schema$Request {
  return {
    mergeCells: {
      range: { sheetId, startRowIndex: r1, endRowIndex: r2, startColumnIndex: c1, endColumnIndex: c2 },
      mergeType: 'MERGE_ALL',
    },
  }
}

function cellStyle(
  sheetId: number,
  r1: number,
  r2: number,
  c1: number,
  c2: number,
  fmt: sheets_v4.Schema$CellFormat,
): sheets_v4.Schema$Request {
  return {
    repeatCell: {
      range: { sheetId, startRowIndex: r1, endRowIndex: r2, startColumnIndex: c1, endColumnIndex: c2 },
      cell: { userEnteredFormat: fmt },
      fields:
        'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,wrapStrategy,borders,padding)',
    },
  }
}

function luxuryKpiCard(sheetId: number, labelRow: number, valueRow: number, col: number, width: number) {
  const end = col + width
  return [
    merge(sheetId, labelRow, col, labelRow, end),
    merge(sheetId, valueRow, col, valueRow, end),
    cellStyle(sheetId, labelRow, labelRow + 1, col, end, {
      backgroundColor: SPLARO.card,
      textFormat: {
        foregroundColor: SPLARO.muted,
        fontSize: 9,
        bold: false,
        fontFamily: FONT,
      },
      horizontalAlignment: 'LEFT',
      verticalAlignment: 'BOTTOM',
      wrapStrategy: 'CLIP',
      padding: { top: 10, bottom: 2, left: 12, right: 8 },
      borders: {
        left: { style: 'SOLID', color: SPLARO.border, width: 1 },
        right: { style: 'SOLID', color: SPLARO.border, width: 1 },
        top: { style: 'SOLID', color: SPLARO.border, width: 1 },
      },
    }),
    cellStyle(sheetId, valueRow, valueRow + 1, col, end, {
      backgroundColor: SPLARO.card,
      textFormat: {
        foregroundColor: SPLARO.primary,
        fontSize: 22,
        bold: true,
        fontFamily: FONT,
      },
      horizontalAlignment: 'LEFT',
      verticalAlignment: 'TOP',
      wrapStrategy: 'CLIP',
      padding: { top: 2, bottom: 12, left: 12, right: 8 },
      borders: {
        left: { style: 'SOLID', color: SPLARO.border, width: 1 },
        right: { style: 'SOLID', color: SPLARO.border, width: 1 },
        bottom: { style: 'SOLID', color: SPLARO.accent, width: 2 },
      },
    }),
  ]
}

function sectionTitle(sheetId: number, row: number, col: number, width: number) {
  return [
    merge(sheetId, row, col, row, col + width),
    cellStyle(sheetId, row, row + 1, col, col + width, {
      backgroundColor: SPLARO.bg,
      textFormat: { foregroundColor: SPLARO.primary, fontSize: 11, bold: true, fontFamily: FONT },
      horizontalAlignment: 'LEFT',
      verticalAlignment: 'MIDDLE',
      padding: { top: 8, bottom: 4, left: 4 },
    }),
  ]
}

function tableHeader(sheetId: number, row: number, c1: number, c2: number) {
  return cellStyle(sheetId, row, row + 1, c1, c2, {
    backgroundColor: SPLARO.bg,
    textFormat: { foregroundColor: SPLARO.muted, fontSize: 9, bold: true, fontFamily: FONT },
    horizontalAlignment: 'LEFT',
    verticalAlignment: 'MIDDLE',
    borders: { bottom: { style: 'SOLID', color: SPLARO.accent, width: 1 } },
    padding: { top: 6, bottom: 6, left: 8 },
  })
}

export function buildDashboardDesignRequests(sheetId: number, layout: DashboardLayout): sheets_v4.Schema$Request[] {
  const W = DASH_COLS
  const CW = 5
  const {
    values,
    chartData,
    topProductTableStart,
    topProductTableEnd,
    customerTitleRow,
    customerDataRow,
    financeTitleRow,
    financeDataRow,
    systemTitleRow,
    systemHeaderRow,
    systemDataStart,
    systemDataEnd,
    activityTitleRow,
    activityHeaderRow,
    activityDataStart,
    activityDataEnd,
  } = layout

  const requests: sheets_v4.Schema$Request[] = [
    {
      updateSheetProperties: {
        properties: {
          sheetId,
          gridProperties: { frozenRowCount: 2, columnCount: W, rowCount: Math.max(120, values.length + 5) },
          tabColor: SPLARO.accent,
        },
        fields: 'gridProperties(frozenRowCount,columnCount,rowCount),tabColor',
      },
    },
    // Page background
    cellStyle(sheetId, 0, values.length, 0, W, {
      backgroundColor: SPLARO.bg,
      textFormat: { fontFamily: FONT },
    }),
    // Header title
    merge(sheetId, 0, 0, 0, 13),
    merge(sheetId, 0, 13, 0, W),
    cellStyle(sheetId, 0, 1, 0, 13, {
      backgroundColor: SPLARO.white,
      textFormat: { foregroundColor: SPLARO.primary, fontSize: 18, bold: true, fontFamily: FONT },
      horizontalAlignment: 'LEFT',
      verticalAlignment: 'MIDDLE',
      padding: { left: 16, top: 14, bottom: 14 },
    }),
    cellStyle(sheetId, 0, 1, 13, W, {
      backgroundColor: SPLARO.white,
      textFormat: { foregroundColor: SPLARO.muted, fontSize: 10, fontFamily: FONT },
      horizontalAlignment: 'RIGHT',
      verticalAlignment: 'MIDDLE',
      padding: { right: 16 },
    }),
    {
      updateDimensionProperties: {
        range: { sheetId, dimension: 'ROWS', startIndex: 0, endIndex: 1 },
        properties: { pixelSize: 52 },
        fields: 'pixelSize',
      },
    },
    // Status bar
    merge(sheetId, 1, 0, 1, 5),
    merge(sheetId, 1, 5, 1, 10),
    merge(sheetId, 1, 10, 1, 15),
    merge(sheetId, 1, 15, 1, W),
    cellStyle(sheetId, 1, 2, 0, W, {
      backgroundColor: SPLARO.white,
      textFormat: { foregroundColor: SPLARO.muted, fontSize: 10, fontFamily: FONT },
      horizontalAlignment: 'LEFT',
      padding: { left: 16, bottom: 10 },
    }),
    {
      updateDimensionProperties: {
        range: { sheetId, dimension: 'ROWS', startIndex: 1, endIndex: 2 },
        properties: { pixelSize: 30 },
        fields: 'pixelSize',
      },
    },
    // Gold divider
    cellStyle(sheetId, 2, 3, 0, W, {
      backgroundColor: SPLARO.white,
      borders: { bottom: { style: 'SOLID', color: SPLARO.accent, width: 1 } },
    }),
    { updateDimensionProperties: { range: { sheetId, dimension: 'ROWS', startIndex: 2, endIndex: 3 }, properties: { pixelSize: 6 }, fields: 'pixelSize' } },
    // KPI cards
    ...luxuryKpiCard(sheetId, 3, 4, 0, CW),
    ...luxuryKpiCard(sheetId, 3, 4, 5, CW),
    ...luxuryKpiCard(sheetId, 3, 4, 10, CW),
    ...luxuryKpiCard(sheetId, 3, 4, 15, CW),
    ...luxuryKpiCard(sheetId, 6, 7, 0, CW),
    ...luxuryKpiCard(sheetId, 6, 7, 5, CW),
    ...luxuryKpiCard(sheetId, 6, 7, 10, CW),
    ...luxuryKpiCard(sheetId, 6, 7, 15, CW),
    {
      updateDimensionProperties: {
        range: { sheetId, dimension: 'ROWS', startIndex: 3, endIndex: 8 },
        properties: { pixelSize: 36 },
        fields: 'pixelSize',
      },
    },
    {
      updateDimensionProperties: {
        range: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: W },
        properties: { pixelSize: 78 },
        fields: 'pixelSize',
      },
    },
    // Section titles
    ...sectionTitle(sheetId, 9, 0, 8),
    ...sectionTitle(sheetId, topProductTableStart, 0, 10),
    tableHeader(sheetId, topProductTableStart + 1, 0, 5),
    // Product table rows
    cellStyle(sheetId, topProductTableStart + 2, topProductTableEnd, 0, 5, {
      backgroundColor: SPLARO.white,
      textFormat: { foregroundColor: SPLARO.primary, fontSize: 10, fontFamily: FONT },
      horizontalAlignment: 'LEFT',
      padding: { top: 6, bottom: 6, left: 8 },
      borders: { bottom: { style: 'SOLID', color: SPLARO.border, width: 1 } },
    }),
    // Stock conditional formatting
    {
      addConditionalFormatRule: {
        index: 0,
        rule: {
          ranges: [{
            sheetId,
            startRowIndex: topProductTableStart + 2,
            endRowIndex: topProductTableEnd,
            startColumnIndex: 1,
            endColumnIndex: 2,
          }],
          booleanRule: {
            condition: { type: 'NUMBER_LESS_THAN_EQ', values: [{ userEnteredValue: '5' }] },
            format: {
              backgroundColor: { red: 1, green: 0.94, blue: 0.94 },
              textFormat: { foregroundColor: SPLARO.danger, bold: true },
            },
          },
        },
      },
    },
    {
      addConditionalFormatRule: {
        index: 1,
        rule: {
          ranges: [{
            sheetId,
            startRowIndex: topProductTableStart + 2,
            endRowIndex: topProductTableEnd,
            startColumnIndex: 1,
            endColumnIndex: 2,
          }],
          booleanRule: {
            condition: { type: 'NUMBER_GREATER_THAN_EQ', values: [{ userEnteredValue: '10' }] },
            format: {
              backgroundColor: { red: 0.94, green: 0.99, blue: 0.95 },
              textFormat: { foregroundColor: SPLARO.success, bold: true },
            },
          },
        },
      },
    },
    // Customer mini-KPIs
    ...sectionTitle(sheetId, customerTitleRow, 0, 10),
    cellStyle(sheetId, customerDataRow, customerDataRow + 1, 0, W, {
      backgroundColor: SPLARO.white,
      textFormat: { fontFamily: FONT, fontSize: 10 },
      padding: { top: 8, bottom: 8, left: 8 },
      borders: { bottom: { style: 'SOLID', color: SPLARO.border, width: 1 } },
    }),
    cellStyle(sheetId, customerDataRow, customerDataRow + 1, 0, 2, {
      backgroundColor: SPLARO.white,
      textFormat: { foregroundColor: SPLARO.muted, fontSize: 9, fontFamily: FONT },
    }),
    cellStyle(sheetId, customerDataRow, customerDataRow + 1, 1, 2, {
      backgroundColor: SPLARO.white,
      textFormat: { foregroundColor: SPLARO.primary, fontSize: 14, bold: true, fontFamily: FONT },
    }),
    cellStyle(sheetId, customerDataRow, customerDataRow + 1, 2, 4, {
      backgroundColor: SPLARO.white,
      textFormat: { foregroundColor: SPLARO.muted, fontSize: 9, fontFamily: FONT },
    }),
    cellStyle(sheetId, customerDataRow, customerDataRow + 1, 3, 4, {
      backgroundColor: SPLARO.white,
      textFormat: { foregroundColor: SPLARO.primary, fontSize: 14, bold: true, fontFamily: FONT },
    }),
    cellStyle(sheetId, customerDataRow, customerDataRow + 1, 4, 6, {
      backgroundColor: SPLARO.white,
      textFormat: { foregroundColor: SPLARO.muted, fontSize: 9, fontFamily: FONT },
    }),
    cellStyle(sheetId, customerDataRow, customerDataRow + 1, 5, 6, {
      backgroundColor: SPLARO.white,
      textFormat: { foregroundColor: SPLARO.primary, fontSize: 14, bold: true, fontFamily: FONT },
    }),
    cellStyle(sheetId, customerDataRow, customerDataRow + 1, 6, 8, {
      backgroundColor: SPLARO.white,
      textFormat: { foregroundColor: SPLARO.muted, fontSize: 9, fontFamily: FONT },
    }),
    cellStyle(sheetId, customerDataRow, customerDataRow + 1, 7, 8, {
      backgroundColor: SPLARO.white,
      textFormat: { foregroundColor: SPLARO.primary, fontSize: 14, bold: true, fontFamily: FONT },
    }),
    cellStyle(sheetId, customerDataRow, customerDataRow + 1, 8, 10, {
      backgroundColor: SPLARO.white,
      textFormat: { foregroundColor: SPLARO.muted, fontSize: 9, fontFamily: FONT },
    }),
    cellStyle(sheetId, customerDataRow, customerDataRow + 1, 9, 10, {
      backgroundColor: SPLARO.white,
      textFormat: { foregroundColor: SPLARO.primary, fontSize: 14, bold: true, fontFamily: FONT },
    }),
    // Finance mini-KPIs
    ...sectionTitle(sheetId, financeTitleRow, 0, 10),
    cellStyle(sheetId, financeDataRow, financeDataRow + 1, 0, W, {
      backgroundColor: SPLARO.white,
      textFormat: { fontFamily: FONT, fontSize: 10 },
      padding: { top: 8, bottom: 8, left: 8 },
      borders: { bottom: { style: 'SOLID', color: SPLARO.border, width: 1 } },
    }),
    cellStyle(sheetId, financeDataRow, financeDataRow + 1, 0, 2, {
      backgroundColor: SPLARO.white,
      textFormat: { foregroundColor: SPLARO.muted, fontSize: 9, fontFamily: FONT },
    }),
    cellStyle(sheetId, financeDataRow, financeDataRow + 1, 1, 2, {
      backgroundColor: SPLARO.white,
      textFormat: { foregroundColor: SPLARO.primary, fontSize: 13, bold: true, fontFamily: FONT },
    }),
    cellStyle(sheetId, financeDataRow, financeDataRow + 1, 2, 4, {
      backgroundColor: SPLARO.white,
      textFormat: { foregroundColor: SPLARO.muted, fontSize: 9, fontFamily: FONT },
    }),
    cellStyle(sheetId, financeDataRow, financeDataRow + 1, 3, 4, {
      backgroundColor: SPLARO.white,
      textFormat: { foregroundColor: SPLARO.primary, fontSize: 13, bold: true, fontFamily: FONT },
    }),
    cellStyle(sheetId, financeDataRow, financeDataRow + 1, 4, 6, {
      backgroundColor: SPLARO.white,
      textFormat: { foregroundColor: SPLARO.muted, fontSize: 9, fontFamily: FONT },
    }),
    cellStyle(sheetId, financeDataRow, financeDataRow + 1, 5, 6, {
      backgroundColor: SPLARO.white,
      textFormat: { foregroundColor: SPLARO.success, fontSize: 13, bold: true, fontFamily: FONT },
    }),
    cellStyle(sheetId, financeDataRow, financeDataRow + 1, 6, 8, {
      backgroundColor: SPLARO.white,
      textFormat: { foregroundColor: SPLARO.muted, fontSize: 9, fontFamily: FONT },
    }),
    cellStyle(sheetId, financeDataRow, financeDataRow + 1, 7, 8, {
      backgroundColor: SPLARO.white,
      textFormat: { foregroundColor: SPLARO.primary, fontSize: 13, bold: true, fontFamily: FONT },
    }),
    cellStyle(sheetId, financeDataRow, financeDataRow + 1, 8, 10, {
      backgroundColor: SPLARO.white,
      textFormat: { foregroundColor: SPLARO.muted, fontSize: 9, fontFamily: FONT },
    }),
    cellStyle(sheetId, financeDataRow, financeDataRow + 1, 9, 10, {
      backgroundColor: SPLARO.white,
      textFormat: { foregroundColor: SPLARO.primary, fontSize: 13, bold: true, fontFamily: FONT },
    }),
    cellStyle(sheetId, financeDataRow, financeDataRow + 1, 10, 12, {
      backgroundColor: SPLARO.white,
      textFormat: { foregroundColor: SPLARO.muted, fontSize: 9, fontFamily: FONT },
    }),
    cellStyle(sheetId, financeDataRow, financeDataRow + 1, 11, 12, {
      backgroundColor: SPLARO.white,
      textFormat: { foregroundColor: SPLARO.primary, fontSize: 13, bold: true, fontFamily: FONT },
    }),
    // System status
    ...sectionTitle(sheetId, systemTitleRow, 0, 10),
    tableHeader(sheetId, systemHeaderRow, 0, 3),
    cellStyle(sheetId, systemDataStart, systemDataEnd, 0, 3, {
      backgroundColor: SPLARO.white,
      textFormat: { foregroundColor: SPLARO.primary, fontSize: 10, fontFamily: FONT },
      padding: { top: 6, bottom: 6, left: 8 },
      borders: { bottom: { style: 'SOLID', color: SPLARO.border, width: 1 } },
    }),
    {
      addConditionalFormatRule: {
        index: 2,
        rule: {
          ranges: [{ sheetId, startRowIndex: systemDataStart, endRowIndex: systemDataEnd, startColumnIndex: 1, endColumnIndex: 2 }],
          booleanRule: {
            condition: { type: 'TEXT_CONTAINS', values: [{ userEnteredValue: 'Connected' }] },
            format: { textFormat: { foregroundColor: SPLARO.success, bold: true } },
          },
        },
      },
    },
    {
      addConditionalFormatRule: {
        index: 3,
        rule: {
          ranges: [{ sheetId, startRowIndex: systemDataStart, endRowIndex: systemDataEnd, startColumnIndex: 1, endColumnIndex: 2 }],
          booleanRule: {
            condition: { type: 'TEXT_CONTAINS', values: [{ userEnteredValue: 'Disconnected' }] },
            format: { textFormat: { foregroundColor: SPLARO.danger, bold: true } },
          },
        },
      },
    },
    // Recent activity
    ...sectionTitle(sheetId, activityTitleRow, 0, 10),
    cellStyle(sheetId, activityTitleRow + 1, activityTitleRow + 2, 0, 4, {
      backgroundColor: SPLARO.bg,
      textFormat: { foregroundColor: SPLARO.primary, fontSize: 10, bold: true, fontFamily: FONT },
      padding: { left: 8 },
    }),
    cellStyle(sheetId, activityTitleRow + 1, activityTitleRow + 2, 4, 8, {
      backgroundColor: SPLARO.bg,
      textFormat: { foregroundColor: SPLARO.primary, fontSize: 10, bold: true, fontFamily: FONT },
      padding: { left: 8 },
    }),
    tableHeader(sheetId, activityHeaderRow, 0, 8),
    cellStyle(sheetId, activityDataStart, activityDataEnd, 0, 8, {
      backgroundColor: SPLARO.white,
      textFormat: { foregroundColor: SPLARO.primary, fontSize: 10, fontFamily: FONT },
      padding: { top: 5, bottom: 5, left: 8 },
      borders: { bottom: { style: 'SOLID', color: SPLARO.border, width: 1 } },
    }),
    // Hide chart data
    {
      updateDimensionProperties: {
        range: { sheetId, dimension: 'ROWS', startIndex: DATA_ROW_START, endIndex: values.length },
        properties: { hiddenByUser: true },
        fields: 'hiddenByUser',
      },
    },
  ]

  const softAxis = { axis: [{ position: 'BOTTOM_AXIS' }, { position: 'LEFT_AXIS' }] }

  // Revenue & Orders trend (combo area)
  if (chartData.trendEnd > chartData.trendStart) {
    requests.push({
      addChart: {
        chart: {
          spec: {
            title: 'Sales & Orders Trend',
            titleTextFormat: { bold: true, fontSize: 12, foregroundColor: SPLARO.primary, fontFamily: FONT },
            backgroundColor: SPLARO.white,
            basicChart: {
              chartType: 'LINE',
              legendPosition: 'BOTTOM_LEGEND',
              headerCount: 1,
              domains: [{
                domain: {
                  sourceRange: {
                    sources: [{ sheetId, startRowIndex: chartData.trendStart, endRowIndex: chartData.trendEnd, startColumnIndex: 0, endColumnIndex: 1 }],
                  },
                },
              }],
              series: [
                {
                  series: {
                    sourceRange: {
                      sources: [{ sheetId, startRowIndex: chartData.trendStart, endRowIndex: chartData.trendEnd, startColumnIndex: 1, endColumnIndex: 2 }],
                    },
                  },
                  color: SPLARO.accent,
                  targetAxis: 'LEFT_AXIS',
                },
                {
                  series: {
                    sourceRange: {
                      sources: [{ sheetId, startRowIndex: chartData.trendStart, endRowIndex: chartData.trendEnd, startColumnIndex: 2, endColumnIndex: 3 }],
                    },
                  },
                  color: SPLARO.primary,
                  targetAxis: 'RIGHT_AXIS',
                },
              ],
              ...softAxis,
            },
          },
          position: {
            overlayPosition: {
              anchorCell: { sheetId, rowIndex: 10, columnIndex: 0 },
              widthPixels: 560,
              heightPixels: 280,
            },
          },
        },
      },
    })
  }

  // Customer growth
  if (chartData.customerEnd > chartData.customerStart) {
    requests.push({
      addChart: {
        chart: {
          spec: {
            title: 'Customer Growth',
            titleTextFormat: { bold: true, fontSize: 12, foregroundColor: SPLARO.primary, fontFamily: FONT },
            backgroundColor: SPLARO.white,
            basicChart: {
              chartType: 'AREA',
              legendPosition: 'NO_LEGEND',
              headerCount: 1,
              domains: [{
                domain: {
                  sourceRange: {
                    sources: [{ sheetId, startRowIndex: chartData.customerStart, endRowIndex: chartData.customerEnd, startColumnIndex: 0, endColumnIndex: 1 }],
                  },
                },
              }],
              series: [{
                series: {
                  sourceRange: {
                    sources: [{ sheetId, startRowIndex: chartData.customerStart, endRowIndex: chartData.customerEnd, startColumnIndex: 1, endColumnIndex: 2 }],
                  },
                },
                color: SPLARO.accent,
                targetAxis: 'LEFT_AXIS',
              }],
              ...softAxis,
            },
          },
          position: {
            overlayPosition: {
              anchorCell: { sheetId, rowIndex: 10, columnIndex: 7 },
              widthPixels: 520,
              heightPixels: 280,
            },
          },
        },
      },
    })
  }

  // Top products bar
  if (chartData.productEnd > chartData.productStart) {
    requests.push({
      addChart: {
        chart: {
          spec: {
            title: 'Top Products · Stock',
            titleTextFormat: { bold: true, fontSize: 12, foregroundColor: SPLARO.primary, fontFamily: FONT },
            backgroundColor: SPLARO.white,
            basicChart: {
              chartType: 'BAR',
              legendPosition: 'NO_LEGEND',
              headerCount: 1,
              domains: [{
                domain: {
                  sourceRange: {
                    sources: [{ sheetId, startRowIndex: chartData.productStart, endRowIndex: chartData.productEnd, startColumnIndex: 0, endColumnIndex: 1 }],
                  },
                },
              }],
              series: [{
                series: {
                  sourceRange: {
                    sources: [{ sheetId, startRowIndex: chartData.productStart, endRowIndex: chartData.productEnd, startColumnIndex: 1, endColumnIndex: 2 }],
                  },
                },
                color: SPLARO.accent,
                targetAxis: 'LEFT_AXIS',
              }],
              ...softAxis,
            },
          },
          position: {
            overlayPosition: {
              anchorCell: { sheetId, rowIndex: 10, columnIndex: 14 },
              widthPixels: 480,
              heightPixels: 280,
            },
          },
        },
      },
    })
  }

  // Categories donut
  if (chartData.categoryEnd > chartData.categoryStart) {
    requests.push({
      addChart: {
        chart: {
          spec: {
            title: 'Catalog Overview',
            titleTextFormat: { bold: true, fontSize: 11, foregroundColor: SPLARO.primary, fontFamily: FONT },
            backgroundColor: SPLARO.white,
            pieChart: {
              legendPosition: 'LABELED_LEGEND',
              domain: {
                sourceRange: {
                  sources: [{ sheetId, startRowIndex: chartData.categoryStart, endRowIndex: chartData.categoryEnd, startColumnIndex: 0, endColumnIndex: 1 }],
                },
              },
              series: {
                sourceRange: {
                  sources: [{ sheetId, startRowIndex: chartData.categoryStart, endRowIndex: chartData.categoryEnd, startColumnIndex: 1, endColumnIndex: 2 }],
                },
              },
            },
          },
          position: {
            overlayPosition: {
              anchorCell: { sheetId, rowIndex: 24, columnIndex: 0 },
              widthPixels: 400,
              heightPixels: 240,
            },
          },
        },
      },
    })
  }

  return requests
}

export async function prepareDashboardSheet(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  sheetId: number,
  rowCount: number,
) {
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets(properties.sheetId,conditionalFormats,merges,charts)',
  })

  const deleteRequests: object[] = []

  for (const sheet of meta.data.sheets ?? []) {
    if (sheet.properties?.sheetId !== sheetId) continue

    for (const chart of sheet.charts ?? []) {
      if (chart.chartId != null) deleteRequests.push({ deleteEmbeddedObject: { objectId: chart.chartId } })
    }

    const ruleCount = sheet.conditionalFormats?.length ?? 0
    for (let i = ruleCount - 1; i >= 0; i--) {
      deleteRequests.push({ deleteConditionalFormatRule: { sheetId, index: i } })
    }

    deleteRequests.push({
      unmergeCells: {
        range: { sheetId, startRowIndex: 0, endRowIndex: rowCount, startColumnIndex: 0, endColumnIndex: DASH_COLS },
      },
    })
    break
  }

  if (deleteRequests.length) {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: deleteRequests } })
  }
}

export async function clearDashboardCharts(sheets: sheets_v4.Sheets, spreadsheetId: string) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets(charts,properties)' })
  const deleteRequests: object[] = []
  for (const sheet of meta.data.sheets ?? []) {
    if (sheet.properties?.title !== 'Dashboard') continue
    for (const chart of sheet.charts ?? []) {
      if (chart.chartId != null) deleteRequests.push({ deleteEmbeddedObject: { objectId: chart.chartId } })
    }
  }
  if (deleteRequests.length) {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: deleteRequests } })
  }
}
