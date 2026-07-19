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

export const BUSINESS_SHEET_TABS = [
  'Dashboard',
  'Orders',
  'Customers',
  'Subscribers',
  'Products & Stock',
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
    'Product Link',
  ],
}
