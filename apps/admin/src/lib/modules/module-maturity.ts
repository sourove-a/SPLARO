import { REGISTERED_MODULE_HREFS } from '@/lib/modules/registry'
import { flatAdminRoutes } from '@/lib/navigation/admin-nav'

export type ModuleMaturity = 'live' | 'beta' | 'prototype'

/** Routes with dedicated live panels in the module registry. */
const LIVE_ROUTES = new Set<string>(['/dashboard', ...REGISTERED_MODULE_HREFS])

/**
 * Registered routes with partial API — preview actions, coming-soon forms, or read-only shells.
 * Checked before LIVE_ROUTES so maturity is not overstated.
 */
const BETA_ROUTES = new Set<string>([
  '/dashboard/wms/overview',
  '/dashboard/wms/warehouses',
  '/dashboard/wms/stock-movements',
  '/dashboard/wms/transfers',
  '/dashboard/procurement/overview',
  '/dashboard/procurement/suppliers',
  '/dashboard/procurement/purchase-orders',
  '/dashboard/procurement/goods-received',
  '/dashboard/production/overview',
  '/dashboard/production/fabric-inventory',
  '/dashboard/support/helpdesk',
  '/dashboard/support/live-chat',
  '/dashboard/delivery/agents',
  '/dashboard/delivery/assignments',
  '/dashboard/company/dashboard',
  '/dashboard/company/employees',
  '/dashboard/company/payroll',
  '/dashboard/company/tasks',
  '/dashboard/company/documents',
  '/dashboard/warehouse',
  '/dashboard/supplier-management',
  '/dashboard/google-workspace/docs',
  '/dashboard/google-workspace/calendar',
  '/dashboard/google-workspace/contacts',
  '/dashboard/google-workspace/analytics',
  '/dashboard/google-workspace/search-console',
  '/dashboard/google-workspace/merchant-center',
])

/** Nav routes without a dedicated panel — GenericModulePanel fallback. */
const PROTOTYPE_ROUTES = new Set<string>(
  flatAdminRoutes
    .map((r) => r.href.replace(/\/+$/, '') || '/dashboard')
    .filter((href) => !LIVE_ROUTES.has(href) && !BETA_ROUTES.has(href)),
)

const MATURITY_META: Record<
  ModuleMaturity,
  { label: string; hint: string; className: string }
> = {
  live: {
    label: 'Live',
    hint: 'Connected to SPLARO API — real store data.',
    className: 'admin-module-status--live',
  },
  beta: {
    label: 'Beta',
    hint: 'Beta — core reads and selected writes via commerce-os; export, payroll pay, and doc upload not connected.',
    className: 'admin-module-status--beta',
  },
  prototype: {
    label: 'Preview',
    hint: 'UI shell only — no verified backend write path.',
    className: 'admin-module-status--prototype',
  },
}

/** Modules with dedicated API record pages (not generic local draft). */
export const BACKEND_RECORD_API_MODULES = new Set<string>([
  '/dashboard/products',
  '/dashboard/orders',
  '/dashboard/customers',
  '/dashboard/invoices',
  '/dashboard/finance/partner-accounts',
  '/dashboard/finance/investments',
  '/dashboard/finance/withdrawals',
])

export function hasBackendRecordApi(moduleHref: string): boolean {
  const normalized = moduleHref.replace(/\/+$/, '') || '/dashboard'
  return BACKEND_RECORD_API_MODULES.has(normalized)
}

/** Modules with verified server-side create flow in admin (not generic fallback). */
export const BACKEND_CREATE_API_MODULES = new Set<string>([
  '/dashboard/products',
  '/dashboard/orders',
])

export function hasBackendCreateApi(moduleHref: string): boolean {
  const normalized = moduleHref.replace(/\/+$/, '') || '/dashboard'
  return BACKEND_CREATE_API_MODULES.has(normalized)
}

export function getModuleMaturity(href: string): ModuleMaturity {
  const normalized = href.replace(/\/+$/, '') || '/dashboard'
  if (PROTOTYPE_ROUTES.has(normalized)) return 'prototype'
  if (BETA_ROUTES.has(normalized)) return 'beta'
  if (LIVE_ROUTES.has(normalized)) return 'live'
  return 'prototype'
}

export function getModuleMaturityMeta(href: string) {
  return MATURITY_META[getModuleMaturity(href)]
}

export function shouldShowModuleStatusBanner(href: string) {
  return getModuleMaturity(href) !== 'live'
}
