import type { sheets_v4 } from 'googleapis'

type Rgb = { red: number; green: number; blue: number }

const BRIGHT = {
  green: { red: 0, green: 1, blue: 0.2 } as Rgb,
  yellow: { red: 1, green: 0.92, blue: 0 } as Rgb,
  red: { red: 1, green: 0.15, blue: 0.15 } as Rgb,
  orange: { red: 1, green: 0.55, blue: 0 } as Rgb,
  blue: { red: 0.1, green: 0.45, blue: 1 } as Rgb,
  purple: { red: 0.65, green: 0.2, blue: 1 } as Rgb,
  cyan: { red: 0, green: 0.85, blue: 1 } as Rgb,
  pink: { red: 1, green: 0.2, blue: 0.6 } as Rgb,
  gold: { red: 0.78, green: 0.66, blue: 0.49 } as Rgb,
  dark: { red: 0.067, green: 0.067, blue: 0.067 } as Rgb,
  white: { red: 1, green: 1, blue: 1 } as Rgb,
}

const BADGE_RULE_FMT = {
  textFormat: { bold: true, foregroundColor: BRIGHT.white },
}

const BADGE_CELL_FMT = {
  horizontalAlignment: 'CENTER' as const,
  verticalAlignment: 'MIDDLE' as const,
  wrapStrategy: 'CLIP' as const,
  textFormat: { bold: true, fontSize: 10, foregroundColor: BRIGHT.white },
}

const ORDER_STATUS_COLORS: Record<string, Rgb> = {
  PENDING: BRIGHT.yellow,
  CONFIRMED: BRIGHT.blue,
  PROCESSING: BRIGHT.orange,
  PACKED: BRIGHT.purple,
  SHIPPED: BRIGHT.cyan,
  COURIER_BOOKED: BRIGHT.cyan,
  PICKED_UP: BRIGHT.purple,
  IN_TRANSIT: BRIGHT.blue,
  OUT_FOR_DELIVERY: BRIGHT.orange,
  DELIVERED: BRIGHT.green,
  RETURNED: BRIGHT.pink,
  CANCELLED: BRIGHT.red,
  REFUNDED: BRIGHT.red,
}

const PAYMENT_STATUS_COLORS: Record<string, Rgb> = {
  UNPAID: BRIGHT.red,
  PENDING: BRIGHT.yellow,
  PAID: BRIGHT.green,
  FAILED: BRIGHT.red,
  REFUNDED: BRIGHT.orange,
  PARTIALLY_REFUNDED: BRIGHT.orange,
}

function statusBadgeRule(
  sheetId: number,
  col: number,
  startRow: number,
  endRow: number,
  status: string,
  color: Rgb,
  index: number,
): sheets_v4.Schema$Request {
  return {
    addConditionalFormatRule: {
      index,
      rule: {
        ranges: [{ sheetId, startRowIndex: startRow, endRowIndex: endRow, startColumnIndex: col, endColumnIndex: col + 1 }],
        booleanRule: {
          condition: { type: 'TEXT_EQ', values: [{ userEnteredValue: status }] },
          format: {
            backgroundColor: color,
            ...BADGE_RULE_FMT,
          },
        },
      },
    },
  }
}

export function buildOrderStatusBadgeRules(
  sheetId: number,
  statusCol: number,
  startRow: number,
  endRow: number,
): sheets_v4.Schema$Request[] {
  return Object.entries(ORDER_STATUS_COLORS).map(([status, color], i) =>
    statusBadgeRule(sheetId, statusCol, startRow, endRow, status, color, i),
  )
}

export function buildPaymentStatusBadgeRules(
  sheetId: number,
  paymentCol: number,
  startRow: number,
  endRow: number,
): sheets_v4.Schema$Request[] {
  return Object.entries(PAYMENT_STATUS_COLORS).map(([status, color], i) =>
    statusBadgeRule(sheetId, paymentCol, startRow, endRow, status, color, i + 20),
  )
}

export function buildStockBadgeRules(
  sheetId: number,
  stockCol: number,
  startRow: number,
  endRow: number,
): sheets_v4.Schema$Request[] {
  return [
    {
      addConditionalFormatRule: {
        index: 40,
        rule: {
          ranges: [{ sheetId, startRowIndex: startRow, endRowIndex: endRow, startColumnIndex: stockCol, endColumnIndex: stockCol + 1 }],
          booleanRule: {
            condition: { type: 'NUMBER_EQ', values: [{ userEnteredValue: '0' }] },
            format: { backgroundColor: BRIGHT.red, ...BADGE_RULE_FMT },
          },
        },
      },
    },
    {
      addConditionalFormatRule: {
        index: 41,
        rule: {
          ranges: [{ sheetId, startRowIndex: startRow, endRowIndex: endRow, startColumnIndex: stockCol, endColumnIndex: stockCol + 1 }],
          booleanRule: {
            condition: { type: 'NUMBER_GREATER_THAN_EQ', values: [{ userEnteredValue: '10' }] },
            format: { backgroundColor: BRIGHT.green, ...BADGE_RULE_FMT },
          },
        },
      },
    },
    {
      addConditionalFormatRule: {
        index: 42,
        rule: {
          ranges: [{ sheetId, startRowIndex: startRow, endRowIndex: endRow, startColumnIndex: stockCol, endColumnIndex: stockCol + 1 }],
          booleanRule: {
            condition: { type: 'NUMBER_BETWEEN', values: [{ userEnteredValue: '1' }, { userEnteredValue: '9' }] },
            format: { backgroundColor: BRIGHT.yellow, textFormat: { bold: true, foregroundColor: BRIGHT.dark } },
          },
        },
      },
    },
  ]
}

export interface DashboardChartData {
  orderStatusCounts: Array<{ status: string; count: number }>
  paymentStatusCounts: Array<{ status: string; count: number }>
  orderStatusStartRow: number
  paymentStatusStartRow: number
}

export function buildDashboardPremiumRequests(
  sheetId: number,
  chartData: DashboardChartData,
  dataEndRow: number,
): sheets_v4.Schema$Request[] {
  const requests: sheets_v4.Schema$Request[] = [
    {
      updateSheetProperties: {
        properties: {
          sheetId,
          gridProperties: { frozenRowCount: 2, columnCount: 12, rowCount: Math.max(40, dataEndRow + 5) },
          tabColor: BRIGHT.gold,
        },
        fields: 'gridProperties(frozenRowCount,columnCount,rowCount),tabColor',
      },
    },
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 8 },
        cell: {
          userEnteredFormat: {
            backgroundColor: BRIGHT.dark,
            textFormat: { foregroundColor: BRIGHT.gold, bold: true, fontSize: 16 },
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
        properties: { pixelSize: 52 },
        fields: 'pixelSize',
      },
    },
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: 8 },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0, green: 0.35, blue: 0.15 },
            textFormat: { foregroundColor: BRIGHT.green, bold: true, fontSize: 11 },
            horizontalAlignment: 'CENTER',
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
      },
    },
    {
      updateDimensionProperties: {
        range: { sheetId, dimension: 'ROWS', startIndex: 1, endIndex: 2 },
        properties: { pixelSize: 28 },
        fields: 'pixelSize',
      },
    },
  ]

  const kpiRows = [3, 5, 7]
  const kpiColors = [BRIGHT.blue, BRIGHT.green, BRIGHT.gold, BRIGHT.purple, BRIGHT.orange, BRIGHT.cyan]
  let colorIdx = 0
  for (const row of kpiRows) {
    for (const colStart of [0, 2, 4, 6]) {
      const color = kpiColors[colorIdx++ % kpiColors.length]
      requests.push(
        {
          mergeCells: {
            range: { sheetId, startRowIndex: row, endRowIndex: row + 2, startColumnIndex: colStart, endColumnIndex: colStart + 2 },
            mergeType: 'MERGE_ALL',
          },
        },
        {
          repeatCell: {
            range: { sheetId, startRowIndex: row, endRowIndex: row + 2, startColumnIndex: colStart, endColumnIndex: colStart + 2 },
            cell: {
              userEnteredFormat: {
                backgroundColor: color,
                textFormat: { foregroundColor: BRIGHT.white, bold: true, fontSize: 11 },
                horizontalAlignment: 'CENTER',
                verticalAlignment: 'MIDDLE',
                wrapStrategy: 'WRAP',
              },
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,wrapStrategy)',
          },
        },
      )
    }
  }

  const chartStartRow = chartData.orderStatusStartRow
  if (chartData.orderStatusCounts.length > 0 && chartStartRow > 0) {
    const statusEnd = chartStartRow + chartData.orderStatusCounts.length
    requests.push({
      addChart: {
        chart: {
          spec: {
            title: 'Orders by Status',
            titleTextFormat: { foregroundColor: BRIGHT.dark, bold: true, fontSize: 12 },
            backgroundColor: { red: 0.98, green: 0.98, blue: 0.98 },
            pieChart: {
              legendPosition: 'LABELED_LEGEND',
              domain: {
                sourceRange: {
                  sources: [{ sheetId, startRowIndex: chartStartRow, endRowIndex: statusEnd, startColumnIndex: 0, endColumnIndex: 1 }],
                },
              },
              series: {
                sourceRange: {
                  sources: [{ sheetId, startRowIndex: chartStartRow, endRowIndex: statusEnd, startColumnIndex: 1, endColumnIndex: 2 }],
                },
              },
            },
          },
          position: {
            overlayPosition: {
              anchorCell: { sheetId, rowIndex: chartStartRow - 1, columnIndex: 3 },
              widthPixels: 420,
              heightPixels: 280,
            },
          },
        },
      },
    })
  }

  if (chartData.paymentStatusCounts.length > 0 && chartData.paymentStatusStartRow > 0) {
    const payStart = chartData.paymentStatusStartRow
    const payEnd = payStart + chartData.paymentStatusCounts.length
    requests.push({
      addChart: {
        chart: {
          spec: {
            title: 'Payment Status',
            titleTextFormat: { foregroundColor: BRIGHT.dark, bold: true, fontSize: 12 },
            backgroundColor: { red: 0.98, green: 0.98, blue: 0.98 },
            basicChart: {
              chartType: 'COLUMN',
              legendPosition: 'BOTTOM_LEGEND',
              domains: [{
                domain: {
                  sourceRange: {
                    sources: [{ sheetId, startRowIndex: payStart, endRowIndex: payEnd, startColumnIndex: 0, endColumnIndex: 1 }],
                  },
                },
              }],
              series: [{
                series: {
                  sourceRange: {
                    sources: [{ sheetId, startRowIndex: payStart, endRowIndex: payEnd, startColumnIndex: 1, endColumnIndex: 2 }],
                  },
                },
                targetAxis: 'LEFT_AXIS',
              }],
              headerCount: 0,
            },
          },
          position: {
            overlayPosition: {
              anchorCell: { sheetId, rowIndex: payStart - 1, columnIndex: 3 },
              widthPixels: 420,
              heightPixels: 260,
            },
          },
        },
      },
    })
  }

  return requests
}

export function buildOrdersPremiumRequests(
  sheetId: number,
  dataStartRow: number,
  dataEndRow: number,
): sheets_v4.Schema$Request[] {
  const requests: sheets_v4.Schema$Request[] = [
    {
      updateSheetProperties: {
        properties: { sheetId, tabColor: BRIGHT.blue },
        fields: 'tabColor',
      },
    },
    ...buildOrderStatusBadgeRules(sheetId, 5, dataStartRow, dataEndRow),
    ...buildPaymentStatusBadgeRules(sheetId, 6, dataStartRow, dataEndRow),
    {
      repeatCell: {
        range: { sheetId, startRowIndex: dataStartRow, endRowIndex: dataEndRow, startColumnIndex: 5, endColumnIndex: 7 },
        cell: {
          userEnteredFormat: {
            padding: { top: 4, bottom: 4, left: 8, right: 8 },
            ...BADGE_CELL_FMT,
          },
        },
        fields: 'userEnteredFormat(padding,horizontalAlignment,verticalAlignment,wrapStrategy,textFormat)',
      },
    },
    {
      updateDimensionProperties: {
        range: { sheetId, dimension: 'ROWS', startIndex: dataStartRow, endIndex: dataEndRow },
        properties: { pixelSize: 34 },
        fields: 'pixelSize',
      },
    },
    {
      updateDimensionProperties: {
        range: { sheetId, dimension: 'COLUMNS', startIndex: 5, endIndex: 7 },
        properties: { pixelSize: 130 },
        fields: 'pixelSize',
      },
    },
    {
      repeatCell: {
        range: { sheetId, startRowIndex: dataStartRow, endRowIndex: dataEndRow, startColumnIndex: 3, endColumnIndex: 4 },
        cell: { userEnteredFormat: { numberFormat: { type: 'TEXT' } } },
        fields: 'userEnteredFormat.numberFormat',
      },
    },
  ]
  return requests
}

export function buildProductsPremiumRequests(
  sheetId: number,
  dataStartRow: number,
  dataEndRow: number,
): sheets_v4.Schema$Request[] {
  return [
    {
      updateSheetProperties: {
        properties: { sheetId, tabColor: BRIGHT.orange },
        fields: 'tabColor',
      },
    },
    ...buildStockBadgeRules(sheetId, 7, dataStartRow, dataEndRow),
    {
      updateDimensionProperties: {
        range: { sheetId, dimension: 'ROWS', startIndex: dataStartRow, endIndex: dataEndRow },
        properties: { pixelSize: 32 },
        fields: 'pixelSize',
      },
    },
  ]
}
