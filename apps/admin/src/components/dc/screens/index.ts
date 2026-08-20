/**
 * Maps the design prototype's screen ids onto real admin routes.
 *
 * The prototype names screens (`wms`, `pl`, `apihealth`); the app routes them by
 * href. This table is the only place the two vocabularies meet.
 */

import {
  CONTENT_PAGES,
  EMPTY,
  MODULE_PAGES,
  SCREENS,
  type EmptyDef,
  type PageMeta,
  type ScreenCtx,
} from './data'

/** Prototype screen id → primary admin href. */
export const SCREEN_HREF: Record<string, string> = {
  analytics: '/dashboard/analytics',
  returns: '/dashboard/returns-rma',
  reviews: '/dashboard/product-reviews',
  collections: '/dashboard/collections',
  categories: '/dashboard/categories',
  inventory: '/dashboard/inventory',
  bulk: '/dashboard/bulk',
  wms: '/dashboard/wms/overview',
  procurement: '/dashboard/procurement/overview',
  sms: '/dashboard/sms',
  sheets: '/dashboard/automation/google-sheets-sync',
  operations: '/dashboard/operations',
  finance: '/dashboard/finance/finance-reports',
  pl: '/dashboard/finance/profit-loss',
  orderprofit: '/dashboard/finance/order-profit',
  expenses: '/dashboard/finance/expenses',
  campaigns: '/dashboard/campaigns',
  coupons: '/dashboard/coupons',
  homepage: '/dashboard/home-page',
  hero: '/dashboard/hero-slider',
  media: '/dashboard/media-library',
  menu: '/dashboard/menu-control',
  legal: '/dashboard/legal-pages',
  integrations: '/dashboard/all-integrations',
  telegram: '/dashboard/telegram-bot',
  apihealth: '/dashboard/api-health',
  ai: '/dashboard/ai-agent',
  seo: '/dashboard/seo-health',
  automation: '/dashboard/automation-rules',
  security: '/dashboard/security-center',
  staff: '/dashboard/admin-users',
  exports: '/dashboard/executive/export-center',
  footwear: '/dashboard/footwear-page',
  theme: '/dashboard/branding',
  branding: '/dashboard/branding',
  lookbooks: '/dashboard/lookbooks',
  reels: '/dashboard/reels',
  blog: '/dashboard/blog',
  cms: '/dashboard/cms',
  landing: '/dashboard/landing-pages',
  // Not designed as block screens, but the `nav` tab strip links to them.
  dashboard: '/dashboard',
  orders: '/dashboard/orders',
  products: '/dashboard/products',
  customers: '/dashboard/customers',
  settings: '/dashboard/settings',
  packing: '/dashboard/packing-station',
  courier: '/dashboard/courier-hub',
  partners: '/dashboard/finance/partner-accounts',
  dailyclose: '/dashboard/finance/daily-closing',
}

/**
 * Extra hrefs that render the same designed screen. The prototype has one WMS
 * screen; the app splits warehouses, transfers and movements into sibling routes.
 */
const HREF_ALIASES: Record<string, string> = {
  '/dashboard/wms/warehouses': 'wms',
  '/dashboard/wms/transfers': 'wms',
  '/dashboard/wms/stock-movements': 'wms',
  '/dashboard/warehouse': 'wms',
  '/dashboard/procurement/purchase-orders': 'procurement',
  '/dashboard/procurement/suppliers': 'procurement',
  '/dashboard/procurement/goods-received': 'procurement',
  '/dashboard/supplier-management': 'procurement',
  '/dashboard/google-workspace/sheets-sync': 'sheets',
  '/dashboard/finance/google-sheets-finance': 'sheets',
  '/dashboard/email-sms': 'sms',
  '/dashboard/system/telegram-logs': 'telegram',
  '/dashboard/telegram-bot': 'telegram',
  '/dashboard/system-health': 'apihealth',
  '/dashboard/audit-logs': 'security',
  '/dashboard/permissions': 'staff',
  '/dashboard/roles': 'staff',
}

const HREF_SCREEN: Record<string, string> = (() => {
  const out: Record<string, string> = { ...HREF_ALIASES }
  for (const [screen, href] of Object.entries(SCREEN_HREF)) {
    // Only block-driven screens resolve by href; the bespoke ones (orders,
    // products, …) keep their existing implementations.
    if (screen in SCREENS) out[href] = screen
  }
  return out
})()

export function screenKeyForHref(href: string): string | undefined {
  return HREF_SCREEN[href]
}

export function hrefForScreen(screen: string): string | undefined {
  return SCREEN_HREF[screen]
}


/** Header meta: title, group, status chip, sync line and header actions. */
export function metaForScreen(screen: string): PageMeta | undefined {
  const tuple = MODULE_PAGES[screen]
  if (tuple) {
    const [title, group, status, sync, actions] = tuple
    return {
      title,
      group,
      status,
      sync,
      actions: actions.map(([label, icon, kind]) => ({ label, icon, kind })),
    }
  }
  return CONTENT_PAGES[screen]
}

export function emptyForScreen(screen: string): EmptyDef | undefined {
  return EMPTY[screen]
}


export { SCREENS, MODULE_PAGES, EMPTY, CONTENT_PAGES }
export type { ScreenCtx, PageMeta, EmptyDef }
export { DcCustomer360 } from './DcCustomer360'
export { DcProductEdit } from './DcProductEdit'
export { DcProductNew } from './DcProductNew'
export { DcOrderNew } from './DcOrderNew'
export { DcOrderDetail } from './DcOrderDetail'
export { DcModuleHost } from './DcModuleHost'
export { DcExports } from './DcExports'
