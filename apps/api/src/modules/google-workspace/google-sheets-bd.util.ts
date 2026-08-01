const BD_TZ = 'Asia/Dhaka'

/** e.g. 24 Jun 2026, 3:45 PM */
export function formatDateTimeBD(date: Date | string | null | undefined): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: BD_TZ,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(d)
}

/** e.g. 24 Jun 2026 */
export function formatDateBD(date: Date | string | null | undefined): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: BD_TZ,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d)
}

export function formatMoneyBDT(amount: number | string | { toString(): string } | null | undefined): string {
  const n = Number(amount ?? 0)
  return `৳${n.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

export {
  formatBdPhoneDisplay as formatPhoneBD,
  formatPhoneForGoogleSheet,
} from '../../common/bd-phone.util'

/**
 * Every tab the business spreadsheet owns. `ensureBusinessTabs` creates any
 * that are missing and `populateBusinessSpreadsheet` fills them, so adding a
 * name here is what brings a tab into existence.
 *
 * The eight finance and operations tabs below were mapped in the admin and
 * counted in "n of 12 tabs set up" long before anything wrote them — the
 * screen reported them as "Not set up" because they genuinely were.
 */
export const BUSINESS_SHEET_TABS = [
  'Dashboard',
  'Orders',
  'Customers',
  'Subscribers',
  'Products & Stock',
  'Partner Accounts',
  'Expenses',
  'Profit & Loss',
  'Courier',
  'Payments',
  'Daily Summary',
  'Telegram Logs',
  'AI Jobs',
] as const

export type BusinessSheetTab = (typeof BUSINESS_SHEET_TABS)[number]

export const SHEET_HEADERS: Record<BusinessSheetTab, string[]> = {
  Dashboard: ['Metric', 'Value', 'Updated (BD Time)'],
  Orders: [
    'Invoice #',
    'Order Date (BD)',
    'Customer Name',
    'Phone (01X)',
    'Email',
    'Status',
    'Payment Status',
    'Payment Method',
    'Subtotal',
    'Delivery',
    'Discount',
    'Total (BDT)',
    'City',
    'District',
    'Division',
    'Products',
    'Qty',
    'Notes',
  ],
  Customers: [
    'Customer ID',
    'Joined (BD)',
    'Name',
    'Phone',
    'Email',
    'Total Orders',
    'Total Spent (BDT)',
    'Loyalty Tier',
    'Points',
    'Last Order (BD)',
    'Marketing OK',
    'Tags',
  ],
  Subscribers: ['Email', 'Status', 'Source', 'Subscribed (BD)', 'Updated (BD)', 'Subscriber ID'],
  'Products & Stock': [
    'Product Name',
    'SKU',
    'Slug',
    'Status',
    'Base Price (BDT)',
    'Size',
    'Color',
    'Stock Qty',
    'Reserved',
    'Available',
    'Published',
    'Featured',
    'Last Updated (BD)',
    'Product ID',
    'Variant ID',
    'Image Link',
    'Product Link',
  ],
  'Partner Accounts': [
    'Partner',
    'Share %',
    'Investment (BDT)',
    'Withdrawn (BDT)',
    'Sales Contribution (BDT)',
    'Expense Share (BDT)',
    'Profit Share (BDT)',
    'Current Balance (BDT)',
    'Phone',
    'Email',
    'Partner ID',
  ],
  Expenses: [
    'Date (BD)',
    'Category',
    'Amount (BDT)',
    'Status',
    'Partner',
    'Note',
    'Recorded By',
    'Approved By',
    'Approved (BD)',
    'Expense ID',
  ],
  'Profit & Loss': [
    'Period Start (BD)',
    'Period End (BD)',
    'Gross Revenue (BDT)',
    'Product Cost (BDT)',
    'Courier Cost (BDT)',
    'Packaging (BDT)',
    'Gateway Fee (BDT)',
    'Discount (BDT)',
    'Return Loss (BDT)',
    'Net Profit (BDT)',
    'Order ID',
    'Calculated (BD)',
  ],
  Courier: [
    'Invoice #',
    'Provider',
    'Status',
    'Consignment',
    'Tracking Code',
    'Delivery Charge (BDT)',
    'COD Amount (BDT)',
    'Booked (BD)',
    'Picked Up (BD)',
    'Delivered (BD)',
    'Tracking Link',
  ],
  Payments: [
    'Payment #',
    'Invoice #',
    'Method',
    'Status',
    'Amount (BDT)',
    'Currency',
    'Transaction ID',
    'Paid (BD)',
    'Refunded (BD)',
    'Refund Amount (BDT)',
    'Failure Reason',
  ],
  'Daily Summary': [
    'Closing Date (BD)',
    'Orders',
    'Revenue (BDT)',
    'Expenses (BDT)',
    'Net Profit (BDT)',
    'Status',
    'Closed By',
    'Approved By',
    'Notes',
  ],
  'Telegram Logs': [
    'Sent (BD)',
    'Type',
    'Command',
    'Success',
    'Telegram User',
    'Message',
  ],
  'AI Jobs': [
    'Created (BD)',
    'Type',
    'Status',
    'Model',
    'Tokens',
    'Cost (USD)',
    'Started (BD)',
    'Completed (BD)',
    'Error',
    'Job ID',
  ],
}
