import { REGISTERED_MODULE_HREFS } from '@/lib/modules/registry'
import { flatAdminRoutes } from '@/lib/navigation/admin-nav'

export type ModuleMaturity = 'live' | 'beta' | 'prototype'

/** Routes backed by a real screen and API, as listed in the module registry. */
const LIVE_ROUTES = new Set<string>(['/dashboard', ...REGISTERED_MODULE_HREFS])

function getLiveRoutes(): Set<string> {
  return LIVE_ROUTES
}

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
  '/dashboard/delivery/agents',
  '/dashboard/delivery/assignments',
  '/dashboard/company/dashboard',
  '/dashboard/company/employees',
  '/dashboard/company/payroll',
  '/dashboard/company/tasks',
  '/dashboard/warehouse',
  '/dashboard/supplier-management',
])

/**
 * UI shells / read-only placeholders — no verified backend write path.
 * Keep these out of BETA so the banner matches reality.
 */
const PROTOTYPE_SHELL_ROUTES = new Set<string>([
  '/dashboard/support/live-chat',
  '/dashboard/company/documents',
  '/dashboard/google-workspace/docs',
  '/dashboard/google-workspace/calendar',
  '/dashboard/google-workspace/contacts',
  '/dashboard/google-workspace/analytics',
  '/dashboard/google-workspace/search-console',
  '/dashboard/google-workspace/merchant-center',
])

/** Nav routes without a dedicated panel — GenericModulePanel fallback. */
let prototypeRoutes: Set<string> | null = null
function getPrototypeRoutes(): Set<string> {
  if (!prototypeRoutes) {
    const live = getLiveRoutes()
    prototypeRoutes = new Set<string>([
      ...PROTOTYPE_SHELL_ROUTES,
      ...flatAdminRoutes
        .map((r) => r.href.replace(/\/+$/, '') || '/dashboard')
        .filter(
          (href) => !live.has(href) && !BETA_ROUTES.has(href) && !PROTOTYPE_SHELL_ROUTES.has(href),
        ),
    ])
  }
  return prototypeRoutes
}

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
    hint: 'Beta — commerce-os reads and selected writes work; export / payroll pay and some actions stay disconnected.',
    className: 'admin-module-status--beta',
  },
  prototype: {
    label: 'Preview',
    hint: 'UI shell only — no verified backend write path. Nothing you click here is saved.',
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
  '/dashboard/customers',
  '/dashboard/collections',
  '/dashboard/categories',
])

export function hasBackendCreateApi(moduleHref: string): boolean {
  const normalized = moduleHref.replace(/\/+$/, '') || '/dashboard'
  return BACKEND_CREATE_API_MODULES.has(normalized)
}

export function getModuleMaturity(href: string): ModuleMaturity {
  const normalized = href.replace(/\/+$/, '') || '/dashboard'
  // Shells first — never overstate as beta/live.
  if (PROTOTYPE_SHELL_ROUTES.has(normalized) || getPrototypeRoutes().has(normalized)) {
    return 'prototype'
  }
  if (BETA_ROUTES.has(normalized)) return 'beta'
  if (getLiveRoutes().has(normalized)) return 'live'
  return 'prototype'
}

export function getModuleMaturityMeta(href: string) {
  return MATURITY_META[getModuleMaturity(href)]
}

export function shouldShowModuleStatusBanner(href: string) {
  return getModuleMaturity(href) !== 'live'
}
