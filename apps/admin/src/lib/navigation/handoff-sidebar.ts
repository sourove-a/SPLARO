/**
 * Design-handoff sidebar — exact groups/items from the approved DC nav list.
 * Everything else stays reachable by URL but is not shown in the primary sidebar.
 */

import type { AdminNavGroup, AdminNavItem } from './admin-nav'
import { getNavItemByHref } from './admin-nav'
import type { AdminNavSession } from './admin-nav-permissions'
import { canAccessNavRoute } from './admin-nav-permissions'

/** Pinned block (top of sidebar), in order. */
export const HANDOFF_PINNED_HREFS = [
  '/dashboard',
  '/dashboard/orders',
  '/dashboard/products',
  '/dashboard/packing-station',
  '/dashboard/finance/partner-accounts',
] as const

/**
 * Group → hrefs. Labels/icons come from adminNavGroups via getNavItemByHref.
 * Order inside each group is intentional.
 */
export const HANDOFF_SIDEBAR_GROUPS: ReadonlyArray<{ group: string; hrefs: readonly string[] }> = [
  {
    group: 'Overview',
    hrefs: [
      '/dashboard/analytics',
      '/dashboard/mobile-screens',
      '/dashboard/executive/notification-center',
    ],
  },
  {
    group: 'Commerce',
    hrefs: ['/dashboard/returns-rma'],
  },
  {
    group: 'Catalog',
    hrefs: [
      '/dashboard/product-reviews',
      '/dashboard/collections',
      '/dashboard/categories',
      '/dashboard/inventory',
      '/dashboard/bulk',
    ],
  },
  {
    group: 'Customers',
    hrefs: ['/dashboard/customers'],
  },
  {
    group: 'Operations',
    hrefs: [
      '/dashboard/operations',
      '/dashboard/courier-hub',
      '/dashboard/wms/overview',
      '/dashboard/procurement/purchase-orders',
      '/dashboard/procurement/suppliers',
      '/dashboard/procurement/goods-received',
    ],
  },
  {
    group: 'Finance',
    hrefs: [
      '/dashboard/finance/finance-reports',
      '/dashboard/finance/profit-loss',
      '/dashboard/finance/daily-closing',
    ],
  },
  {
    group: 'Marketing',
    hrefs: ['/dashboard/campaigns', '/dashboard/coupons'],
  },
  {
    group: 'Content',
    hrefs: [
      '/dashboard/home-page',
      '/dashboard/hero-slider',
      '/dashboard/media-library',
      '/dashboard/menu-control',
      '/dashboard/legal-pages',
      '/dashboard/footwear-page',
      '/dashboard/theme-builder',
      '/dashboard/lookbooks',
      '/dashboard/reels',
      '/dashboard/blog',
      '/dashboard/cms',
      '/dashboard/landing-pages',
    ],
  },
  {
    group: 'Integrations',
    hrefs: [
      '/dashboard/all-integrations',
      '/dashboard/telegram-bot',
      '/dashboard/api-health',
      '/dashboard/sms',
      '/dashboard/automation/google-sheets-sync',
      '/dashboard/google-workspace/connect',
      '/dashboard/webhooks',
    ],
  },
  {
    group: 'Intelligence',
    hrefs: [
      '/dashboard/ai-agent',
      '/dashboard/seo-health',
      '/dashboard/automation-rules',
    ],
  },
  {
    group: 'Security',
    hrefs: ['/dashboard/security-center', '/dashboard/admin-users'],
  },
  {
    group: 'System',
    hrefs: ['/dashboard/settings', '/dashboard/executive/export-center', '/dashboard/logs'],
  },
]

/** Display label overrides so sidebar matches the design copy exactly. */
const LABEL_OVERRIDES: Record<string, string> = {
  '/dashboard/returns-rma': 'Returns / RMA',
  '/dashboard/wms/overview': 'Warehouse & Stock',
  '/dashboard/procurement/purchase-orders': 'Purchase Orders',
  '/dashboard/finance/finance-reports': 'Finance Overview',
  '/dashboard/automation/google-sheets-sync': 'Google Sheets',
  '/dashboard/ai-agent': 'AI Command Brain',
  '/dashboard/telegram-bot': 'Telegram Bot',
  '/dashboard/executive/export-center': 'Export Center',
}

function resolveItem(href: string): AdminNavItem | null {
  const found = getNavItemByHref(href)
  if (!found) return null
  const label = LABEL_OVERRIDES[href] ?? found.label
  return { ...found, label, href }
}

/** Sidebar groups for the DC shell — design list only. */
export function getHandoffSidebarNavGroups(session?: AdminNavSession | null): AdminNavGroup[] {
  return HANDOFF_SIDEBAR_GROUPS.map(({ group, hrefs }) => {
    const items = hrefs
      .map((href) => resolveItem(href))
      .filter((item): item is AdminNavItem => {
        if (!item) return false
        if (session && !canAccessNavRoute(item.href, session, 'view')) return false
        return true
      })
    return { group, items }
  }).filter((g) => g.items.length > 0)
}
