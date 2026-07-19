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
      item('Business Intelligence', 'business-intelligence', 'LineChart', 'Executive analytics and forecasts'),
      item('Revenue Center', 'revenue-center', 'TrendingUp', 'Revenue breakdown, forecasts, and targets'),
    ],
  },
  {
    group: 'Executive',
    items: [
      item('CEO Dashboard', 'executive/ceo-dashboard', 'Crown', 'Executive KPIs, AI chat, and store pulse'),
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
      item('Products', 'products', 'Package', 'Product catalog and variant management'),
      item('Product Reviews', 'product-reviews', 'MessageSquareQuote', 'Approve, reject, and moderate customer reviews'),
      item('Collections', 'collections', 'Layers', 'Curated product collections'),
      item('Categories', 'categories', 'FolderTree', 'Category hierarchy and navigation'),
      item('Inventory', 'inventory', 'Archive', 'Stock levels, alerts, and adjustments'),
      item('Brands', 'brands', 'Award', 'Brand profiles and vendor associations'),
      item('Attributes', 'attributes', 'Tags', 'Size, colour, and variant attributes'),
      item('SKU Manager', 'sku-manager', 'Hash', 'SKU codes across catalog'),
      item('QR Manager', 'qr-manager', 'QrCode', 'Product QR labels'),
      item('Barcode Manager', 'barcode-manager', 'Barcode', 'Barcode generation and print'),
    ],
  },
  {
    group: 'Customers',
    items: [
      item('Customers', 'customers', 'Users', 'Customer profiles and order history'),
      item('VIP Members', 'vip-members', 'Crown', 'VIP tiers and exclusive benefits'),
      item('Loyalty Program', 'loyalty-program', 'Wallet', 'Points, rewards, and redemption'),
    ],
  },
  {
    group: 'Marketing',
    items: [
      item('Campaigns', 'campaigns', 'Megaphone', 'Multi-channel marketing campaigns'),
      item('Coupons', 'coupons', 'Tag', 'Discount codes and promotional rules'),
      item('Email & SMS', 'email-sms', 'Mail', 'Email and SMS broadcast management'),
      item('WhatsApp', 'whatsapp', 'MessageCircle', 'WhatsApp Business messaging'),
      item('Referrals', 'referrals', 'UserPlus', 'Referral program and rewards'),
      item('Affiliate', 'affiliate', 'Link2', 'Affiliate partners and commissions'),
      item('Influencers', 'influencers', 'Star', 'Influencer collaborations'),
      item('Segments', 'segments', 'PieChart', 'Customer segments for campaigns'),
      item('Customer Intelligence', 'customer-intelligence', 'Brain', 'RFM and behavior insights'),
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
      item('Finance Overview', 'finance/finance-reports', 'FileBarChart', 'Live finance overview & exports'),
      item('Partner Hub', 'finance/partner-accounts', 'Users', 'Partner hisab, balance, investment & withdrawal'),
      item('Expenses', 'finance/expenses', 'Receipt', 'Ke kothay koto khoroch — approval workflow'),
      item('Investments', 'finance/investments', 'PiggyBank', 'Partner capital investment'),
      item('Withdrawals', 'finance/withdrawals', 'Banknote', 'Partner withdrawal ledger'),
      item('Profit & Loss', 'finance/profit-loss', 'TrendingUp', 'Daily, weekly, monthly profit reports'),
      item('Daily Closing', 'finance/daily-closing', 'CalendarCheck', 'End-of-day finance closing'),
      item('Google Sheets Finance', 'finance/google-sheets-finance', 'Sheet', 'Live spreadsheet backup & sync'),
    ],
  },
  {
    group: 'Integrations',
    items: [
      item('All Integrations', 'all-integrations', 'Plug', 'Connected apps and services'),
      item('Telegram Bot', 'settings?section=notifications#telegram', 'Send', 'Bot token, chat ID & alerts — Settings → Notifications'),
      item('API Health', 'api-health', 'Activity', 'API uptime and response monitoring'),
      item('Webhooks', 'webhooks', 'Webhook', 'Webhook endpoints and event logs'),
      item('Meta Business', 'meta-business', 'Facebook', 'Meta catalog and ads integration'),
      item('Google Merchant', 'google-merchant', 'ShoppingCart', 'Google Merchant Center feed'),
    ],
  },
  {
    group: 'SEO Center',
    items: [
      item('SEO Health', 'seo-health', 'Activity', 'Site-wide SEO audits and scores'),
      item('Keywords', 'keywords', 'Search', 'Keyword tracking and opportunities'),
      item('Index Monitor', 'index-monitor', 'Globe', 'Search engine indexing status'),
      item('Schema Manager', 'schema-manager', 'Code', 'Structured data and rich snippets'),
      item('Sitemap Manager', 'sitemap-manager', 'Map', 'XML sitemap generation and submission'),
      item('Redirect Manager', 'redirect-manager', 'ArrowRightLeft', 'URL redirects and 404 fixes'),
    ],
  },
  {
    group: 'AI Center',
    items: [
      item('AI Command Brain', 'ai-agent', 'MessageSquare', 'Model, keys & AI instructions — one place'),
      item('AI Content', 'ai-content', 'Sparkles', 'AI-generated product and page content'),
      item('AI SEO', 'ai-seo', 'Globe', 'AI-powered SEO optimization'),
      item('AI Analytics', 'ai-analytics', 'LineChart', 'Predictive analytics and forecasting'),
      item('AI Sales', 'ai-sales', 'TrendingUp', 'Sales recommendations and upsell AI'),
      item('AI Customer Insights', 'ai-customer-insights', 'Users', 'Customer behavior AI analysis'),
      item('AI Product Generator', 'ai-product-generator', 'Wand2', 'Bulk product listing generation'),
    ],
  },
  {
    group: 'Automation',
    items: [
      item('Telegram Notifications', 'automation/telegram-notifications', 'Send', 'Business notification center'),
      item('Google Sheets Sync', 'automation/google-sheets-sync', 'RefreshCw', 'Auto & manual sheet sync'),
      item('Automation Rules', 'automation-rules', 'Zap', 'Workflow automation and triggers'),
      item('AI Product Agent', 'automation/ai-product-agent', 'Wand2', 'AI product listing generator'),
      item('AI SEO Agent', 'automation/ai-seo-agent', 'Globe', 'AI SEO meta & keywords'),
      item('AI Sales Insights', 'automation/ai-sales-insights', 'LineChart', 'AI sales recommendations'),
    ],
  },
  {
    group: 'Operations',
    items: [
      item('Operations Hub', 'operations', 'LayoutGrid', 'Shipping, courier, warehouse & suppliers — live overview'),
      item('Shipping', 'shipping', 'Truck', 'Shipping zones, rates, and carriers'),
      item('Courier Hub', 'courier-hub', 'PackageCheck', 'Courier bookings and tracking'),
      item('Warehouse', 'warehouse', 'Warehouse', 'Warehouse locations and pick lists'),
      item('Supplier Management', 'supplier-management', 'Building2', 'Suppliers, POs, and procurement'),
    ],
  },
  {
    group: 'WMS',
    items: [
      item('WMS Overview', 'wms/overview', 'Warehouse', 'Multi-warehouse stock control'),
      item('Warehouses', 'wms/warehouses', 'Building2', 'Warehouse locations & staff'),
      item('Stock Movements', 'wms/stock-movements', 'ArrowLeftRight', 'Full inventory movement audit'),
      item('Stock Transfers', 'wms/transfers', 'Truck', 'Inter-warehouse transfers'),
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
    items: [
      item('Production Overview', 'production/overview', 'Scissors', 'Fashion production pipeline'),
      item('Fabric Inventory', 'production/fabric-inventory', 'Layers', 'Fabric stock & usage'),
    ],
  },
  {
    group: 'Support',
    items: [
      item('Helpdesk', 'support/helpdesk', 'Headphones', 'Tickets from all channels'),
      item('Live Chat', 'support/live-chat', 'MessageCircle', 'Real-time customer support'),
    ],
  },
  {
    group: 'Delivery',
    items: [
      item('Delivery Agents', 'delivery/agents', 'Bike', 'Rider management & earnings'),
      item('Assignments', 'delivery/assignments', 'MapPin', 'Order pickup & delivery tracking'),
    ],
  },
  {
    group: 'Company OS',
    items: [
      item('Company Dashboard', 'company/dashboard', 'Building', 'Internal workspace overview'),
      item('Employees', 'company/employees', 'Users', 'HR profiles & performance'),
      item('Payroll', 'company/payroll', 'Banknote', 'Salary, bonus, payslips'),
      item('Tasks', 'company/tasks', 'CheckSquare', 'Kanban tasks & projects'),
      item('Documents', 'company/documents', 'FolderOpen', 'Contracts, policies, approvals'),
    ],
  },
  {
    group: 'Media',
    items: [
      item('Video Library', 'video-library', 'Film', 'Video uploads and streaming assets'),
      item('UGC Gallery', 'ugc-gallery', 'Camera', 'User-generated content moderation'),
    ],
  },
  {
    group: 'Marketplace',
    items: [
      item('Marketplace Overview', 'marketplace/overview', 'Store', 'Multi-vendor platform'),
    ],
  },
  {
    group: 'Social Commerce',
    items: [
      item('Social Hub', 'social-commerce/hub', 'Share2', 'FB, IG, TikTok, WhatsApp inbox'),
    ],
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
      item('Disaster Recovery', 'observability/disaster-recovery', 'ShieldAlert', 'Backups & restore'),
    ],
  },
  {
    group: 'Google Workspace',
    items: [
      item('Overview', 'google-workspace', 'Cloud', 'Google integration dashboard'),
      item('Connect Google Account', 'google-workspace/connect', 'Link', 'OAuth 2.0 connect & revoke'),
      item('Google Sheets Sync', 'google-workspace/sheets-sync', 'Sheet', 'Auto sync business data to Sheets'),
      item('Gmail', 'google-workspace/gmail', 'Mail', 'Transactional email via Gmail API'),
      item('Google Drive', 'google-workspace/drive', 'FolderOpen', 'Backups & document folders'),
      item('Google Docs', 'google-workspace/docs', 'FileText', 'Reports & document templates'),
      item('Calendar', 'google-workspace/calendar', 'Calendar', 'Campaign & task scheduling'),
      item('Contacts', 'google-workspace/contacts', 'Users', 'Optional contact sync'),
      item('Analytics', 'google-workspace/analytics', 'BarChart2', 'GA4 metrics dashboard'),
      item('Search Console', 'google-workspace/search-console', 'Globe', 'SEO & indexing data'),
      item('Merchant Center', 'google-workspace/merchant-center', 'ShoppingCart', 'Product feed sync'),
      item('Sync Logs', 'google-workspace/sync-logs', 'Activity', 'Google sync job history'),
      item('OAuth Settings', 'google-workspace/oauth-settings', 'KeyRound', 'Client ID, secret, redirect URI'),
    ],
  },
  {
    group: 'SaaS',
    items: [
      item('Stores', 'stores', 'Store', 'Multi-store management'),
      item('Subscriptions', 'saas-subscriptions', 'Repeat', 'SaaS plan subscriptions'),
      item('Domains', 'domains', 'Globe2', 'Custom domains and DNS'),
      item('Tenants', 'tenants', 'Building', 'Tenant accounts and isolation'),
      item('Billing', 'billing', 'Receipt', 'SaaS billing and invoicing'),
    ],
  },
  {
    group: 'Security',
    items: [
      item('Security Center', 'security-center', 'Shield', 'Security overview and threat monitoring'),
      item('Admin Users', 'admin-users', 'UserCog', 'Admin accounts and access'),
      item('Roles', 'roles', 'ShieldCheck', 'Role definitions and assignments'),
      item('Permissions', 'permissions', 'Lock', 'Granular permission matrix'),
      item('Audit Logs', 'audit-logs', 'ScrollText', 'Admin action audit trail'),
    ],
  },
  {
    group: 'System',
    items: [
      item('Settings', 'settings', 'Settings', 'Global store and platform settings'),
      item('Sync Logs', 'system/sync-logs', 'RefreshCw', 'Google Sheets sync history'),
      item('Telegram Logs', 'system/telegram-logs', 'MessageSquare', 'Bot command & notification logs'),
      item('Finance Audit Logs', 'system/finance-audit-logs', 'ScrollText', 'Sensitive finance change trail'),
      item('Backups', 'backups', 'Database', 'Database backups and restore'),
      item('Logs', 'logs', 'FileText', 'Application and error logs'),
      item('System Health', 'system-health', 'HeartPulse', 'Infrastructure health and uptime'),
    ],
  },
]

/**
 * Registered routes omitted from sidebar & command palette.
 * Direct URLs still resolve — see getNavHiddenReason() for on-page notice.
 */
export const NAV_HIDDEN_HREFS = new Set<string>([
  // Duplicate ops aliases — canonical: WMS / Procurement
  '/dashboard/warehouse',
  '/dashboard/supplier-management',
  // Overview duplicates — Dashboard is the single entry
  '/dashboard/analytics',
  '/dashboard/revenue-center',
  '/dashboard/business-intelligence',
  // Executive — CEO view duplicates Dashboard KPIs
  '/dashboard/executive/ceo-dashboard',
  // Commerce extras — Orders is the daily hub
  '/dashboard/pos',
  '/dashboard/invoices',
  '/dashboard/transactions',
  '/dashboard/subscriptions',
  // Finance sub-routes — tabs inside Partner Hub
  '/dashboard/finance/expenses',
  '/dashboard/finance/investments',
  '/dashboard/finance/withdrawals',
  '/dashboard/finance/google-sheets-finance',
  // Google Workspace — keep Connect + Sheets Sync only
  '/dashboard/google-workspace',
  '/dashboard/google-workspace/docs',
  '/dashboard/google-workspace/calendar',
  '/dashboard/google-workspace/contacts',
  '/dashboard/google-workspace/analytics',
  '/dashboard/google-workspace/search-console',
  '/dashboard/google-workspace/merchant-center',
  '/dashboard/google-workspace/gmail',
  '/dashboard/google-workspace/drive',
  '/dashboard/google-workspace/sync-logs',
  '/dashboard/google-workspace/oauth-settings',
  // Platform / multi-tenant shells — not daily SPLARO ops
  '/dashboard/stores',
  '/dashboard/saas-subscriptions',
  '/dashboard/domains',
  '/dashboard/tenants',
  '/dashboard/billing',
  '/dashboard/marketplace/overview',
  '/dashboard/developer/api-center',
  '/dashboard/observability/center',
  '/dashboard/observability/disaster-recovery',
  '/dashboard/social-commerce/hub',
  // WMS / Procurement / Production — beta shells, not daily retail
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
  // Support / Delivery / Company OS — not connected for daily ops
  '/dashboard/support/helpdesk',
  '/dashboard/support/live-chat',
  '/dashboard/delivery/agents',
  '/dashboard/delivery/assignments',
  '/dashboard/company/dashboard',
  '/dashboard/company/employees',
  '/dashboard/company/payroll',
  '/dashboard/company/tasks',
  '/dashboard/company/documents',
  // Operations duplicate — Courier Hub covers shipping
  '/dashboard/shipping',
  // Automation duplicates — Settings + Google Workspace Sheets
  '/dashboard/automation/telegram-notifications',
  '/dashboard/automation/google-sheets-sync',
  '/dashboard/automation/ai-product-agent',
  '/dashboard/automation/ai-seo-agent',
  '/dashboard/automation/ai-sales-insights',
  // Integrations — advanced / not daily
  '/dashboard/webhooks',
  '/dashboard/meta-business',
  '/dashboard/google-merchant',
  // Media shells
  '/dashboard/video-library',
  '/dashboard/ugc-gallery',
  // AI sub-pages (AI Command Brain is the entry point)
  '/dashboard/ai-content',
  '/dashboard/ai-seo',
  '/dashboard/ai-analytics',
  '/dashboard/ai-sales',
  '/dashboard/ai-customer-insights',
  '/dashboard/ai-product-generator',
  // Marketing — enable when campaigns/channels are live
  '/dashboard/email-sms',
  '/dashboard/whatsapp',
  '/dashboard/influencers',
  '/dashboard/affiliate',
  '/dashboard/referrals',
  '/dashboard/segments',
  '/dashboard/customer-intelligence',
  // Catalog utility duplicates — products/inventory cover daily use
  '/dashboard/sku-manager',
  '/dashboard/qr-manager',
  '/dashboard/barcode-manager',
  '/dashboard/brands',
  '/dashboard/attributes',
  // Growth placeholders
  '/dashboard/vip-members',
  '/dashboard/loyalty-program',
  // Content shells — home/hero/legal/menu cover storefront
  '/dashboard/lookbooks',
  '/dashboard/reels',
  '/dashboard/cms',
  '/dashboard/landing-pages',
  '/dashboard/theme-builder',
  '/dashboard/footwear-page',
  '/dashboard/blog',
  // SEO sub-tools — SEO Health is the hub
  '/dashboard/keywords',
  '/dashboard/index-monitor',
  '/dashboard/schema-manager',
  '/dashboard/sitemap-manager',
  '/dashboard/redirect-manager',
  // Security advanced — single-store admin
  '/dashboard/roles',
  '/dashboard/permissions',
  '/dashboard/audit-logs',
  // System ops — dev/infra, not daily merchant
  '/dashboard/backups',
  '/dashboard/logs',
  '/dashboard/system-health',
  '/dashboard/system/sync-logs',
  '/dashboard/system/telegram-logs',
  '/dashboard/system/finance-audit-logs',
])

/** Shown when a hidden route is opened via bookmark or legacy link. */
export const NAV_HIDDEN_REASONS: Record<string, string> = {
  '/dashboard/warehouse': 'Legacy alias — use Operations Hub or Courier Hub.',
  '/dashboard/supplier-management': 'Hidden — Procurement module not needed for daily retail.',
  '/dashboard/analytics': 'Hidden — use Dashboard for daily KPIs.',
  '/dashboard/revenue-center': 'Hidden — same data as Dashboard.',
  '/dashboard/business-intelligence': 'Hidden — same data as Dashboard.',
  '/dashboard/executive/ceo-dashboard': 'Hidden — use Dashboard.',
  '/dashboard/finance/expenses': 'Partner Hub → Expenses tab এ আছে।',
  '/dashboard/finance/investments': 'Partner Hub → Investment tab এ আছে।',
  '/dashboard/finance/withdrawals': 'Partner Hub → Withdrawal tab এ আছে।',
  '/dashboard/finance/google-sheets-finance': 'Google Workspace → Sheets Sync ব্যবহার করুন।',
  '/dashboard/shipping': 'Courier Hub দিয়ে Steadfast booking করুন।',
  '/dashboard/support/live-chat': 'Live chat connect হয়নি।',
  '/dashboard/support/helpdesk': 'Helpdesk beta — daily ops এ লাগে না।',
  '/dashboard/company/documents': 'Document upload API connect হয়নি।',
  '/dashboard/wms/overview': 'WMS beta — single warehouse এ Inventory যথেষ্ট।',
  '/dashboard/procurement/overview': 'Procurement beta — factory sourcing না হলে লাগে না।',
  '/dashboard/production/overview': 'Production beta — নিজে manufacture না করলে লাগে না।',
  '/dashboard/delivery/agents': 'Steadfast courier ব্যবহার করলে নিজের rider লাগে না।',
  '/dashboard/pos': 'Online store — physical POS লাগলে URL bookmark করুন।',
}

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
  '/dashboard/telegram/config': '/dashboard/settings?section=notifications#telegram',
  '/dashboard/telegram-bot': '/dashboard/settings?section=notifications#telegram',
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
