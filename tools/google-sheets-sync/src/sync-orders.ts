import { google } from 'googleapis'
import type { sheets_v4 } from 'googleapis'
import type { PrismaClient } from '@prisma/client'

const HEADERS = [
  'Order ID',
  'Invoice Number',
  'Date',
  'Customer Name',
  'Phone',
  'City',
  'District',
  'Division',
  'Zone',
  'Products',
  'Qty',
  'Subtotal (৳)',
  'Delivery (৳)',
  'Discount (৳)',
  'Total (৳)',
  'Payment Method',
  'Payment Status',
  'Order Status',
  'Courier',
  'Consignment ID',
  'Tracking Code',
  'Coupon Code',
  'Fraud Score',
]

export async function syncOrdersToSheet(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  prisma: PrismaClient,
  fromDate?: Date,
): Promise<{ synced: number; errors: number }> {
  const orders = await prisma.order.findMany({
    where: fromDate ? { createdAt: { gte: fromDate } } : undefined,
    include: {
      items: true,
      courier: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 10000,
  })

  if (orders.length === 0) return { synced: 0, errors: 0 }

  const rows = orders.map((order) => {
    const products = order.items.map((i) => `${i.productName} (×${i.quantity})`).join(', ')
    const totalQty = order.items.reduce((s, i) => s + i.quantity, 0)

    return [
      order.id,
      order.invoiceNumber,
      order.createdAt.toISOString().split('T')[0],
      order.shippingName,
      order.shippingPhone,
      order.shippingCity,
      order.shippingDistrict,
      order.shippingDivision,
      order.isInsideDhaka ? 'Inside Dhaka' : 'Outside Dhaka',
      products,
      totalQty,
      Number(order.subtotal),
      Number(order.deliveryCharge),
      Number(order.discount),
      Number(order.total),
      order.paymentMethod.replace(/_/g, ' '),
      order.paymentStatus,
      order.status.replace(/_/g, ' '),
      order.courier?.provider ?? '',
      order.courier?.consignmentId ?? '',
      order.courier?.trackingCode ?? '',
      order.couponCode ?? '',
      order.fraudScore ?? '',
    ]
  })

  let synced = 0
  let errors = 0

  try {
    // Ensure headers row exists
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Orders!A1',
      valueInputOption: 'RAW',
      requestBody: { values: [HEADERS] },
    })

    // Write data starting from row 2
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Orders!A2',
      valueInputOption: 'RAW',
      requestBody: { values: rows },
    })

    // Auto-resize columns
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            autoResizeDimensions: {
              dimensions: {
                sheetId: 0,
                dimension: 'COLUMNS',
                startIndex: 0,
                endIndex: HEADERS.length,
              },
            },
          },
        ],
      },
    })

    synced = orders.length
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error(`Orders sheet sync failed: ${message}`)
    errors++
  }

  return { synced, errors }
}
