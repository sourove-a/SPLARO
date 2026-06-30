export const GOOGLE_OAUTH_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/analytics.readonly',
  'https://www.googleapis.com/auth/webmasters.readonly',
  'https://www.googleapis.com/auth/content',
] as const

export const GOOGLE_SHEET_TABS = [
  'Orders',
  'Customers',
  'Subscribers',
  'Products',
  'Inventory',
  'Payments',
  'Courier',
  'Returns',
  'RMA',
  'Reviews',
  'Coupons',
  'Abandoned Carts',
  'Partner Accounts',
  'Expenses',
  'Profit & Loss',
  'Daily Summary',
  'Monthly Summary',
  'Telegram Logs',
  'AI Jobs',
  'Admin Audit Logs',
] as const

export type GoogleSheetTab = (typeof GOOGLE_SHEET_TABS)[number]

export const GOOGLE_SYNC_JOB_TYPES = {
  ORDER: 'google.sync.order',
  CUSTOMER: 'google.sync.customer',
  PRODUCT: 'google.sync.product',
  INVENTORY: 'google.sync.inventory',
  FINANCE: 'google.sync.finance',
  DAILY_SUMMARY: 'google.sync.daily-summary',
  FULL_BACKUP: 'google.sync.full-backup',
  SUBSCRIBER: 'google.sync.subscriber',
} as const

export const GOOGLE_DRIVE_FOLDERS = [
  'SPLARO',
  'SPLARO/Invoices',
  'SPLARO/Reports',
  'SPLARO/Product Media',
  'SPLARO/Backups',
  'SPLARO/Finance',
  'SPLARO/Suppliers',
] as const

export const STANDARD_ROW_HEADERS = [
  'ID',
  'Date',
  'Store',
  'Status',
  'Created By',
  'Updated At',
  'Source',
  'Notes',
] as const
