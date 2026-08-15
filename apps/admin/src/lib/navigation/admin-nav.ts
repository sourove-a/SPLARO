import { canAccessNavRoute, type AdminNavSession } from '@/lib/navigation/admin-nav-permissions'
import {
  FEATURE_FLAG_DEFAULTS,
  featureDisabledReason,
  getFeatureFlagForAdminHref,
  isAdminHrefFeatureDisabled,
  type FeatureFlags,
} from '@splaro/config'

/** Mutable runtime flags — updated by FeatureFlagsProvider after GET /features. */
let runtimeFeatureFlags: FeatureFlags = { ...FEATURE_FLAG_DEFAULTS }

export function setAdminFeatureFlags(flags: FeatureFlags) {
  runtimeFeatureFlags = { ...flags }
}

export function getAdminFeatureFlags(): FeatureFlags {
  return runtimeFeatureFlags
}

export interface AdminNavItem {
  href: string
  label: string
  icon: string
  badge?: string | number
  description?: string
}

export interface AdminNavGroup {
  group: string
  items: AdminNavItem[]
}

export interface FlatAdminRoute extends AdminNavItem {
  group: string
}

export interface CommandNavItem {
  group: string
  label: string
  href: string
  icon: string
  description?: string
  badge?: string | number
}

function item(
  label: string,
  slug: string,
  icon: string,
  description?: string,
  badge?: string | number,
): AdminNavItem {
  const href = slug === '' ? '/dashboard' : `/dashboard/${slug}`
  return {
    href,
    label,
    icon,
    ...(description ? { description } : {}),
    ...(badge !== undefined ? { badge } : {}),
  }
}

export const adminNavGroups: AdminNavGroup[] = [
  {
    group: 'Overview',
    items: [
      item('Dashboard', '', 'LayoutDashboard', 'Real-time store performance and KPIs'),
      item('Analytics', 'analytics', 'BarChart3', 'Sales, traffic, and conversion analytics'),
      item('Mobile screens', 'mobile-screens', 'Smartphone', 'Reference frames for the admin on a phone'),
    ],
  },
  {
    group: 'Executive',
    items: [
      item('Notification Center', 'executive/notification-center', 'Bell', 'Email, SMS, WhatsApp & Telegram delivery log'),
      item('Export Center', 'executive/export-center', 'Download', 'Orders, customers & products CSV export'),
    ],
  },
  {
    group: 'Commerce',
    items: [
      item('Orders', 'orders', 'ShoppingBag', 'Manage and fulfill customer orders'),
      item('Point of Sale', 'pos', 'ScanLine', 'In-store POS checkout and receipts'),
      item('Returns/RMA', 'returns-rma', 'RotateCcw', 'Returns, exchanges, and RMA workflows'),
      item('Invoices', 'invoices', 'FileText', 'Invoice generation and payment tracking'),
      item('Transactions', 'transactions', 'CreditCard', 'Payment transactions and ledger'),
      item('Subscriptions', 'subscriptions', 'Repeat', 'Recurring billing and plans'),
    ],
  },
  {
    group: 'Catalog',
    items: [
      item('Products', 'products', 'Package', 'Catalog list and homepage Men / Women tiles'),
      item('Product Reviews', 'product-reviews', 'MessageSquareQuote', 'Approve, reject, and moderate customer reviews'),
      item('Collections', 'collections', 'Layers', 'Curated product collections'),
      item('Categories', 'categories', 'FolderTree', 'Category hierarchy and navigation'),
      item('Inventory', 'inventory', 'Archive', 'Stock levels, alerts, and adjustments'),
      item('Bulk & CSV', 'bulk', 'FileSpreadsheet', 'Catalog CSV/Excel import & export — stock, price, publish'),
      item('Brands', 'brands', 'Award', 'Brand profiles and vendor associations'),
    ],
  },
  {
    group: 'Customers',
    items: [item('Customers', 'customers', 'Users', 'Customer profiles and order history')],
  },
  {
    group: 'Wholesale',
    items: [
      item('Wholesale Leads', 'wholesale-leads', 'Factory', 'Buyer enquiries from /wholesale'),
      item(
        'Wholesale Stock',
        'wholesale-stock',
        'Image',
        'Stock photos shown on the wholesale page',
      ),
    ],
  },
  {
    group: 'Marketing',
    items: [
      item('Campaigns', 'campaigns', 'Megaphone', 'Multi-channel marketing campaigns'),
      item('Coupons', 'coupons', 'Tag', 'Discount codes and promotional rules'),
    ],
  },
  {
    group: 'Content',
    items: [
      item('Home Page', 'home-page', 'Home', 'Our Story deck cards, homepage sections, and storefront controls'),
      item('Footwear Page', 'footwear-page', 'Footprints', 'Footwear page sections, banners, and visibility'),
      item('Hero Slider', 'hero-slider', 'SlidersHorizontal', 'Hero banners and carousel slides'),
      item('Media Library', 'media-library', 'Image', 'Upload, delete, and manage images'),
      item('Menu Control', 'menu-control', 'Menu', 'Header, footer, and navigation menus'),
      item('Theme Builder', 'theme-builder', 'Palette', 'Visual theme customization'),
      item('Lookbooks', 'lookbooks', 'BookOpen', 'Editorial lookbooks and styling guides'),
      item('Reels', 'reels', 'Video', 'Short-form video and reels management'),
      item('Blog', 'blog', 'Newspaper', 'Blog posts and editorial content'),
      item('Legal Pages', 'legal-pages', 'Scale', 'Terms, privacy, shipping, returns & policies'),
      item('CMS', 'cms', 'FileEdit', 'Static pages and content blocks'),
      item('Landing Pages', 'landing-pages', 'LayoutTemplate', 'Campaign landing pages'),
    ],
  },
  {
    group: 'Finance',
    items: [
      item('Profit & Cash Flow', 'finance/finance-reports', 'FileBarChart', 'Net profit, cash in/out, and cost breakdown'),
      item('Order Profitability', 'finance/order-profit', 'Calculator', 'Per-order selling, cost, margin'),
      item('Expenses', 'finance/expenses', 'Receipt', 'Operating expenses — approve, vendor, recurring'),
      item('Partner Hub', 'finance/partner-accounts', 'Handshake', 'Partner hisab, balance, investment & withdrawal'),
      item('Profit & Loss', 'finance/profit-loss', 'TrendingUp', 'Daily, weekly, monthly profit reports'),
      item('Daily Closing', 'finance/daily-closing', 'CalendarCheck', 'End-of-day finance closing'),
    ],
  },
  {
    group: 'Integrations',
    items: [
      item('All Integrations', 'all-integrations', 'Plug', 'Connected apps and services'),
      item('SMS Center', 'sms', 'MessageSquare', 'BD SMS providers, Bangla segment costing, templates & logs'),
      item('Google Sheets', 'automation/google-sheets-sync', 'Sheet', 'Optional backup export — not the store database'),
      item('Telegram Bot', 'telegram-bot', 'Send', 'Bot token, chat ID & alerts — verified Telegram integration'),
      item('API Health', 'api-health', 'Activity', 'API uptime and response monitoring'),
      item('Webhooks', 'webhooks', 'Webhook', 'Webhook endpoints and event logs'),
    ],
  },
  {
    group: 'SEO Center',
    items: [item('SEO Health', 'seo-health', 'Activity', 'Site-wide SEO audits and scores')],
  },
  {
    group: 'AI Center',
    items: [
      item('AI Command Brain', 'ai-agent', 'MessageSquare', 'Model, keys & AI instructions — one place'),
    ],
  },
  {
    group: 'Automation',
    items: [item('Automation Rules', 'automation-rules', 'Zap', 'Workflow automation and triggers')],
  },
  {
    group: 'Operations',
    items: [
      item('Operations Hub', 'operations', 'LayoutGrid', 'Shipping, courier, warehouse & suppliers — live overview'),
      item('Packing Station', 'packing-station', 'ScanLine', 'Scan barcode to pack or dispatch orders'),
      item('Courier Hub', 'courier-hub', 'PackageCheck', 'Courier bookings and tracking'),
    ],
  },
  {
    group: 'WMS',
    items: [
      item('Warehouse & Stock', 'wms/overview', 'Warehouse', 'Warehouses, transfers, stock movement ledger'),
    ],
  },
  {
    group: 'Procurement',
    items: [
      item('Procurement Hub', 'procurement/overview', 'LayoutGrid', 'Suppliers, POs & GRNs — live overview'),
      item('Suppliers', 'procurement/suppliers', 'Building2', 'Supplier profiles & ledger'),
      item('Purchase Orders', 'procurement/purchase-orders', 'FileText', 'PO workflow & approvals'),
      item('Goods Received', 'procurement/goods-received', 'PackageCheck', 'GRN & receiving'),
    ],
  },
  {
    group: 'Production',
    items: [item('Production Overview', 'production/overview', 'Scissors', 'Fashion production pipeline')],
  },
  {
    group: 'Support',
    items: [item('Helpdesk', 'support/helpdesk', 'Headphones', 'Tickets from all channels')],
  },
  {
    group: 'Delivery',
    items: [item('Delivery Agents', 'delivery/agents', 'Bike', 'Rider management & earnings')],
  },
  {
    group: 'Company OS',
    items: [item('Company Dashboard', 'company/dashboard', 'Building', 'Internal workspace overview')],
  },
  {
    group: 'Developer',
    items: [
      item('API Developer Center', 'developer/api-center', 'Code', 'API keys, webhooks, OAuth, SDK'),
    ],
  },
  {
    group: 'Observability',
    items: [
      item('Observability Center', 'observability/center', 'Activity', 'Errors, performance, queue health'),
    ],
  },
  {
    group: 'Google Workspace',
    items: [
      item('Connect Google Account', 'google-workspace/connect', 'Link', 'OAuth 2.0 connect & revoke'),
      item('Gmail', 'google-workspace/gmail', 'Mail', 'Transactional email via Gmail API'),
      item('Google Drive', 'google-workspace/drive', 'FolderOpen', 'Backups & document folders'),
      item('Sync Logs', 'google-workspace/sync-logs', 'Activity', 'Google sync job history'),
      item('OAuth Settings', 'google-workspace/oauth-settings', 'KeyRound', 'Client ID, secret, redirect URI'),
    ],
  },
  {
    group: 'Security',
    items: [
      item('Security Center', 'security-center', 'Shield', 'Security overview and threat monitoring'),
      item('Admin Users', 'admin-users', 'UserCog', 'Admin accounts and access'),
    ],
  },
  {
    group: 'System',
    items: [
      item('Settings', 'settings', 'Settings', 'Global store and platform settings'),
      item('Logs', 'logs', 'FileText', 'Application and error logs'),
    ],
  },
]

/**
 * Formerly used to omit routes from sidebar/command palette.
 * Empty after all-nav-live cleanup — aliases + REMOVE + WIRE replace hide shells.
 */
export const NAV_HIDDEN_HREFS = new Set<string>([])

/** @deprecated — no hidden primary routes remain; kept for callers. */
export const NAV_HIDDEN_REASONS: Record<string, string> = {}

export function normalizeAdminHref(href: string): string {
  return href.replace(/\/+$/, '') || '/dashboard'
}

export function isNavHiddenFromPrimary(href: string): boolean {
  const normalized = normalizeAdminHref(href)
  if (NAV_HIDDEN_HREFS.has(normalized)) return true
  return isAdminHrefFeatureDisabled(normalized, runtimeFeatureFlags)
}

export function getNavHiddenReason(href: string): string {
  const normalized = normalizeAdminHref(href)
  const flag = getFeatureFlagForAdminHref(normalized)
  if (flag && !runtimeFeatureFlags[flag]) {
    return featureDisabledReason(flag)
  }
  return (
    NAV_HIDDEN_REASONS[normalized] ??
    'Hidden from sidebar — module not needed for daily SPLARO operations. Bookmark still works.'
  )
}

/** Sidebar + palette: visible nav groups only (empty groups removed). RBAC-filtered when session provided. */
export function getSidebarNavGroups(session?: AdminNavSession | null): AdminNavGroup[] {
  return adminNavGroups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          !isNavHiddenFromPrimary(item.href) &&
          (!session || canAccessNavRoute(item.href, session, 'view')),
      ),
    }))
    .filter((group) => group.items.length > 0)
}

/** Flat routes for sidebar & command palette — excludes NAV_HIDDEN_HREFS and RBAC-denied routes. */
export function getVisibleAdminRoutes(session?: AdminNavSession | null): FlatAdminRoute[] {
  return getSidebarNavGroups(session).flatMap(({ group, items }) =>
    items.map((navItem) => ({ ...navItem, group })),
  )
}

/** Sidebar sidebar group order — reused by API Health panel grouping. */
export const ADMIN_NAV_GROUP_ORDER = getSidebarNavGroups().map((g) => g.group)

export const flatAdminRoutes: FlatAdminRoute[] = adminNavGroups.flatMap(({ group, items }) =>
  items.map((navItem) => ({ ...navItem, group })),
)

const routeByHref = new Map(flatAdminRoutes.map((route) => [route.href, route]))

/** Legacy paths that map to canonical nav entries */
const legacyHrefAliases: Record<string, string> = {
  '/dashboard/seo/health': '/dashboard/seo-health',
  '/dashboard/automation/rules': '/dashboard/automation-rules',
  '/dashboard/telegram/config': '/dashboard/telegram-bot',
  '/dashboard/settings?section=notifications#telegram': '/dashboard/telegram-bot',
  '/dashboard/banners': '/dashboard/hero-slider',
  '/dashboard/products/create': '/dashboard/products/new',
  '/dashboard/business-intelligence': '/dashboard/revenue-center',
}

export function getNavItemByHref(href: string): FlatAdminRoute | undefined {
  const normalized = href.replace(/\/+$/, '') || '/dashboard'
  const canonical = legacyHrefAliases[normalized] ?? normalized
  return routeByHref.get(canonical)
}

const DETAIL_PAGE_TITLES: Record<string, string> = {
  Orders: 'Order details',
  Products: 'Product details',
  Invoices: 'Invoice details',
  Customers: 'Customer profile',
  Collections: 'Collection details',
  Categories: 'Category details',
  Coupons: 'Coupon details',
}

function singularNavLabel(label: string): string {
  if (label.endsWith('ies')) return `${label.slice(0, -3)}y`
  if (label.endsWith('s')) return label.slice(0, -1)
  return label
}

function detailPageTitle(label: string): string {
  return DETAIL_PAGE_TITLES[label] ?? `${singularNavLabel(label)} details`
}

export interface ResolvedNavRoute {
  navItem: FlatAdminRoute
  moduleHref: string
  subPath: string[]
  action: 'create' | 'edit' | 'detail' | null
  pageTitle: string
}

export function resolveNavRoute(slug: string[] | undefined): ResolvedNavRoute | undefined {
  if (!slug || slug.length === 0) return undefined

  for (let depth = slug.length; depth >= 1; depth -= 1) {
    const moduleHref = `/dashboard/${slug.slice(0, depth).join('/')}`
    const navItem = getNavItemByHref(moduleHref)
    if (!navItem) continue

    const subPath = slug.slice(depth)
    const lastSegment = subPath[subPath.length - 1]
    const createSegment = subPath[0]
    const action =
      createSegment === 'new' || createSegment === 'create'
        ? 'create'
        : subPath[0] === 'edit' || lastSegment === 'edit'
          ? 'edit'
          : subPath.length > 0
            ? 'detail'
            : null

    // Never dump raw CUID/UUID into the page title — those are DB keys for
    // routing only. Human labels (SPL-1002, product name) live inside the panel.
    const pageTitle =
      action === 'create'
        ? `Create ${singularNavLabel(navItem.label)}`
        : action === 'edit'
          ? `Edit ${singularNavLabel(navItem.label)}`
          : action === 'detail'
            ? detailPageTitle(navItem.label)
            : navItem.label

    return { navItem, moduleHref, subPath, action, pageTitle }
  }

  return undefined
}

export function getRecordIdFromSubPath(
  subPath: string[],
  action: ResolvedNavRoute['action'],
): string | undefined {
  if (!action || action === 'create') return undefined
  if (action === 'edit') {
    if (subPath[0] === 'edit') return subPath[1]
    if (subPath[subPath.length - 1] === 'edit') return subPath[subPath.length - 2]
    return subPath[0]
  }
  return subPath[0]
}

export function hrefFromSlug(slug: string[] | undefined): string {
  if (!slug || slug.length === 0) return '/dashboard'
  return `/dashboard/${slug.join('/')}`
}

export function getCommandItems(session?: AdminNavSession | null): CommandNavItem[] {
  return getVisibleAdminRoutes(session).map(({ group, label, href, icon, description, badge }) => ({
      group,
      label,
      href,
      icon,
      ...(description ? { description } : {}),
      ...(badge !== undefined ? { badge } : {}),
    }))
}

export function getModuleFeatures(navItem: FlatAdminRoute): string[] {
  const featuresByGroup: Record<string, string[]> = {
    Overview: ['Live KPI dashboard', 'CEO insights', 'Export reports', 'AI executive chat'],
    Executive: ['CEO dashboard', 'Notification delivery log', 'CSV export center', 'AI executive chat'],
    WMS: ['Multi-warehouse', 'Bin tracking', 'Stock movements', 'QR/barcode scan'],
    Procurement: ['Suppliers', 'Purchase orders', 'GRN', 'Vendor ledger'],
    Production: ['Fabric inventory', 'Production orders', 'QC workflow', 'Unit costing'],
    Support: ['Omnichannel tickets', 'Live chat', 'Agent assignment', 'SLA tracking'],
    Delivery: ['Rider tracking', 'Assignments', 'Earnings', 'Mobile app ready'],
    'Company OS': ['HR & payroll', 'Tasks', 'Documents', 'Approvals'],
    Marketplace: ['Multi-vendor', 'Settlements', 'Commissions', 'Vendor analytics'],
    'Social Commerce': ['Unified inbox', 'Comment management', 'Lead capture'],
    Developer: ['API keys', 'Webhooks', 'OAuth', 'Sandbox'],
    Observability: ['Health monitoring', 'Error tracking', 'Disaster recovery'],
    Commerce: ['List & filter records', 'Bulk actions', 'Status workflows', 'Export to CSV'],
    Catalog: ['CRUD management', 'Bulk import/export', 'Search & filters', 'Media attachments'],
    Customers: ['360° profiles', 'Segmentation', 'Communication history', 'Lifetime value'],
    Marketing: ['Campaign builder', 'Audience targeting', 'A/B testing', 'Performance tracking'],
    Content: ['Visual editor', 'Draft & publish', 'Preview mode', 'Version history'],
    'SEO Center': ['Health scoring', 'Issue detection', 'Auto-fix suggestions', 'Monitoring alerts'],
    'AI Center': ['AI-assisted workflows', 'Batch processing', 'Prompt templates', 'Review queue'],
    Finance: ['Partner balances', 'P&L reports', 'Approval workflows', 'Audit trail'],
    Integrations: ['Connection status', 'Sync logs', 'Configuration', 'Test connections'],
    Automation: ['Telegram alerts', 'Sheets sync', 'Automation rules', 'AI agents'],
    Operations: ['Shipping & courier', 'Warehouse', 'Suppliers', 'Live hub'],
    Media: ['Upload & organize', 'CDN delivery', 'Alt text management', 'Usage tracking'],
    SaaS: ['Multi-tenant control', 'Plan management', 'Usage metering', 'Billing sync'],
    Security: ['Access control', 'Session management', 'Audit trail', 'Policy enforcement'],
    System: ['Configuration', 'Health monitoring', 'Backup & restore', 'Log viewer'],
  }

  return featuresByGroup[navItem.group] ?? ['Data management', 'Search & filters', 'Export', 'Settings']
}
