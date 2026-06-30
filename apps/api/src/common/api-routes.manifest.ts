/** Pingable GET routes for live health monitoring (storeId=splaro substituted at runtime). */
export interface ApiRouteProbe {
  id: string
  name: string
  group: string
  path: string
  /** 2xx or expected 404 = healthy */
  allowNotFound?: boolean
}

function p(
  id: string,
  name: string,
  group: string,
  path: string,
  opts?: { allowNotFound?: boolean },
): ApiRouteProbe {
  return { id, name, group, path, ...opts }
}

export function buildApiRouteProbes(storeId = 'splaro'): ApiRouteProbe[] {
  const sid = encodeURIComponent(storeId)
  const q = (path: string) => `${path}${path.includes('?') ? '&' : '?'}storeId=${sid}`

  return [
    // ── Core ──────────────────────────────────────────────────────────────
    p('health', 'Health', 'Core', '/health'),
    p('health-full', 'Full Diagnostics', 'Core', '/health/full'),

    // ── Partners ──────────────────────────────────────────────────────────
    p('partners', 'Partner Hub', 'Partners', q('/partners')),
    p('partner-tx', 'Partner Transactions', 'Partners', q('/partner-transactions') + '&limit=5'),
    p('expenses', 'Expenses', 'Partners', q('/expenses') + '&limit=5'),
    p('profit-daily', 'Profit & Loss (Daily)', 'Partners', q('/profit-loss/daily')),
    p('profit-weekly', 'Profit & Loss (Weekly)', 'Partners', q('/profit-loss/weekly')),
    p('profit-monthly', 'Profit & Loss (Monthly)', 'Partners', q('/profit-loss/monthly')),
    p('daily-closing', 'Daily Closing', 'Partners', q('/daily-closing') + '&limit=5'),
    p('finance-dashboard', 'Finance Reports', 'Partners', q('/finance-reports/dashboard')),
    p('partner-hub', 'Partner Accounts', 'Partners', q('/finance-reports/partner-hub')),
    p('finance-audit', 'Finance Audit Logs', 'Partners', q('/finance-reports/audit-logs') + '&limit=5'),
    p('google-sheets', 'Google Sheets Finance', 'Partners', q('/google-sheets/dashboard')),

    // ── Overview ──────────────────────────────────────────────────────────
    p('dashboard-stats', 'Dashboard', 'Overview', q('/admin/dashboard/stats')),
    p('dashboard-kpi', 'Dashboard KPIs', 'Overview', q('/admin/dashboard/kpi')),
    p('dashboard-insights', 'Dashboard Insights', 'Overview', q('/admin/dashboard/insights')),
    p('analytics-stats', 'Analytics', 'Overview', q('/admin/analytics/stats')),
    p('analytics-revenue', 'Revenue Center', 'Overview', q('/admin/analytics/revenue')),
    p('analytics-bi', 'Business Intelligence', 'Overview', q('/admin/analytics/stats')),
    p('commerce-exec', 'CEO Dashboard', 'Overview', q('/commerce-os/executive/dashboard')),
    p('hub-notifications', 'Notification Center', 'Overview', q('/admin/hub/notifications/overview')),
    p('hub-export', 'Export Center', 'Overview', q('/finance-reports/dashboard')),

    // ── Commerce ──────────────────────────────────────────────────────────
    p('orders', 'Orders', 'Commerce', q('/admin/orders') + '&limit=5'),
    p('pos', 'POS', 'Commerce', q('/admin/pos/today')),
    p('rma', 'Returns / RMA', 'Commerce', q('/admin/commerce-finance/returns') + '&limit=5'),
    p('commerce-invoices', 'Invoices', 'Commerce', q('/admin/commerce-finance/invoices') + '&limit=5'),
    p('commerce-transactions', 'Transactions', 'Commerce', q('/admin/commerce-finance/transactions') + '&limit=5'),
    p('admin-invoices', 'Invoice PDF Service', 'Commerce', q('/admin/invoices/health')),
    p('hub-subscriptions', 'Subscriptions', 'Commerce', q('/admin/hub/commerce/subscriptions')),

    // ── Catalog ───────────────────────────────────────────────────────────
    p('products', 'Products', 'Catalog', q('/admin/products') + '&limit=5'),
    p('categories', 'Categories', 'Catalog', q('/admin/categories')),
    p('collections', 'Collections', 'Catalog', q('/admin/collections')),
    p('brands', 'Brands', 'Catalog', q('/admin/brands')),
    p('inventory-alerts', 'Inventory Alerts', 'Catalog', q('/admin/dashboard/inventory-alerts')),
    p('search', 'Product Search', 'Catalog', `/search?q=shirt&storeId=${sid}`),

    // ── Customers ─────────────────────────────────────────────────────────
    p('customers', 'Customers', 'Customers', q('/admin/customers') + '&limit=5'),
    p('loyalty-summary', 'Loyalty Program', 'Customers', q('/admin/loyalty/summary')),
    p('loyalty-referrals', 'Referrals', 'Customers', q('/admin/loyalty/referrals') + '&limit=5'),

    // ── Marketing ─────────────────────────────────────────────────────────
    p('marketing-campaigns', 'Campaigns', 'Marketing', q('/marketing/campaigns')),
    p('coupons', 'Coupons', 'Marketing', q('/admin/coupons')),
    p('marketing-subscribers', 'Email & SMS Subscribers', 'Marketing', q('/marketing/subscribers') + '&limit=5'),
    p('hub-marketing', 'Marketing Overview', 'Marketing', q('/admin/hub/marketing/overview')),

    // ── Content (one probe per admin nav item) ────────────────────────────
    p('content-home', 'Home Page', 'Content', q('/admin/hub/content/overview')),
    p('content-footwear', 'Footwear Page', 'Content', q('/admin/settings')),
    p('content-theme', 'Theme Builder', 'Content', q('/admin/settings')),
    p('content-menus', 'Menu Control', 'Content', q('/admin/content/menus')),
    p('content-hero', 'Hero Slider', 'Content', q('/admin/banners')),
    p('content-lookbooks', 'Lookbooks', 'Content', q('/admin/collections')),
    p('content-reels', 'Reels', 'Content', q('/admin/banners')),
    p('content-blog', 'Blog', 'Content', q('/admin/content/blog') + '&limit=5'),
    p('content-cms', 'CMS', 'Content', q('/admin/content/pages')),
    p('content-legal', 'Legal Pages', 'Content', q('/admin/content/legal-pages')),
    p('storefront-legal', 'Storefront Legal', 'Storefront', q('/storefront/legal-pages/terms')),
    p('content-landing', 'Landing Pages', 'Content', q('/marketing/campaigns')),

    // ── SEO Center ────────────────────────────────────────────────────────
    p('seo-overview', 'SEO Health', 'SEO Center', q('/admin/hub/seo/overview')),
    p('seo-sitemap', 'Sitemap Manager', 'SEO Center', q('/admin/hub/seo/overview')),
    p('seo-audit', 'Product SEO Audit', 'SEO Center', q('/admin/hub/seo/overview')),
    p('hub-seo', 'SEO Hub Overview', 'SEO Center', q('/admin/hub/seo/overview')),

    // ── AI Center ─────────────────────────────────────────────────────────
    p('agent-status', 'AI Command Brain', 'AI Center', q('/agent/status')),
    p('agent-health', 'AI Agent Health', 'AI Center', q('/agent/health')),
    p('ai-jobs', 'AI Product Generator', 'AI Center', q('/ai-product-agent/jobs') + '&limit=5'),

    // ── Finance ───────────────────────────────────────────────────────────
    p('finance-overview', 'Finance Overview', 'Finance', q('/finance-reports/dashboard')),
    p('finance-partner-hub', 'Partner Hub', 'Finance', q('/finance-reports/partner-hub')),
    p('finance-partners', 'Partners', 'Finance', q('/partners')),
    p('finance-expenses', 'Expenses', 'Finance', q('/expenses') + '&limit=5'),
    p('finance-partner-tx', 'Partner Transactions', 'Finance', q('/partner-transactions') + '&limit=5'),
    p('finance-profit-daily', 'P&L Daily', 'Finance', q('/profit-loss/daily')),
    p('finance-profit-monthly', 'P&L Monthly', 'Finance', q('/profit-loss/monthly')),
    p('finance-daily-closing', 'Daily Closing', 'Finance', q('/daily-closing') + '&limit=5'),
    p('finance-google-sheets', 'Google Sheets', 'Finance', q('/google-sheets/dashboard')),
    p('finance-audit-logs', 'Finance Audit', 'Finance', q('/finance-reports/audit-logs') + '&limit=5'),

    // ── Automation ────────────────────────────────────────────────────────
    p('automation-rules', 'Automation Rules', 'Automation', q('/automation/rules')),
    p('automation-logs', 'Automation Logs', 'Automation', q('/automation/logs') + '&limit=5'),
    p('integrations-telegram', 'Telegram Notifications', 'Automation', q('/admin/integrations/telegram')),
    p('integrations-google-sheets', 'Google Sheets Sync', 'Automation', q('/admin/integrations/google-sheets/status')),
    p('integrations-ai', 'AI Product Agent Config', 'Automation', q('/admin/integrations/ai')),

    // ── WMS ───────────────────────────────────────────────────────────────
    p('commerce-wms', 'WMS Overview', 'WMS', q('/commerce-os/wms/overview')),
    p('wms-warehouses', 'Warehouses', 'WMS', q('/commerce-os/wms/warehouses')),
    p('wms-movements', 'Stock Movements', 'WMS', q('/commerce-os/wms/movements')),
    p('wms-transfers', 'Stock Transfers', 'WMS', q('/commerce-os/wms/overview')),

    // ── Procurement ───────────────────────────────────────────────────────
    p('procurement-overview', 'Procurement Overview', 'Procurement', q('/commerce-os/procurement/overview')),
    p('procurement-suppliers', 'Suppliers', 'Procurement', q('/commerce-os/procurement/suppliers')),
    p('procurement-po', 'Purchase Orders', 'Procurement', q('/commerce-os/procurement/purchase-orders')),
    p('procurement-grn', 'Goods Received', 'Procurement', q('/commerce-os/procurement/grns')),

    // ── Production ────────────────────────────────────────────────────────
    p('production-overview', 'Production Overview', 'Production', q('/commerce-os/production/overview')),
    p('production-fabrics', 'Fabric Inventory', 'Production', q('/commerce-os/production/fabrics')),
    p('production-batches', 'Production Batches', 'Production', q('/commerce-os/production/batches')),

    // ── Support ───────────────────────────────────────────────────────────
    p('support-helpdesk', 'Helpdesk', 'Support', q('/commerce-os/helpdesk/overview')),
    p('support-tickets', 'Support Tickets', 'Support', q('/commerce-os/helpdesk/tickets')),

    // ── Delivery ──────────────────────────────────────────────────────────
    p('delivery-overview', 'Delivery Overview', 'Delivery', q('/commerce-os/delivery/overview')),
    p('delivery-agents', 'Delivery Agents', 'Delivery', q('/commerce-os/delivery/agents')),
    p('delivery-assignments', 'Assignments', 'Delivery', q('/commerce-os/delivery/assignments')),

    // ── Company OS ────────────────────────────────────────────────────────
    p('commerce-company', 'Company Dashboard', 'Company OS', q('/commerce-os/company/overview')),
    p('company-employees', 'Employees', 'Company OS', q('/commerce-os/company/employees')),

    // ── Operations ────────────────────────────────────────────────────────
    p('courier-stats', 'Courier Hub', 'Operations', q('/admin/courier/stats/overview')),
    p('courier-list', 'Courier Bookings', 'Operations', q('/admin/courier') + '&limit=5'),
    p('settings', 'Shipping & Settings', 'Operations', q('/admin/settings')),

    // ── Media ─────────────────────────────────────────────────────────────
    p('platform-media', 'Media Library', 'Media', q('/admin/platform/media')),

    // ── Marketplace ───────────────────────────────────────────────────────
    p('platform-marketplace', 'Marketplace Overview', 'Marketplace', q('/admin/platform/marketplace')),

    // ── Social Commerce ───────────────────────────────────────────────────
    p('marketing-social', 'Social Hub', 'Social Commerce', q('/admin/hub/marketing/overview')),

    // ── Developer ─────────────────────────────────────────────────────────
    p('platform-developer', 'API Developer Center', 'Developer', q('/admin/platform/developer')),
    p('webhooks', 'Webhooks', 'Developer', q('/admin/webhooks')),

    // ── Observability ─────────────────────────────────────────────────────
    p('platform-observability', 'Observability Center', 'Observability', q('/admin/platform/observability')),

    // ── Google Workspace ──────────────────────────────────────────────────
    p('google-status', 'Google Workspace', 'Google Workspace', q('/admin/google/status')),
    p('google-sheets-config', 'Sheets Sync Config', 'Google Workspace', q('/admin/google/sheets/config')),
    p('google-gmail-config', 'Gmail Config', 'Google Workspace', q('/admin/google/gmail/config')),
    p('google-sync-logs', 'Sync Logs', 'Google Workspace', q('/admin/google/sync-logs') + '&limit=5'),

    // ── Integrations ──────────────────────────────────────────────────────
    p('integrations-list', 'All Integrations', 'Integrations', q('/admin/integrations')),
    p('integrations-health', 'Integration Health', 'Integrations', q('/admin/integrations/health')),
    p('integrations-catalog', 'Integration Catalog', 'Integrations', q('/admin/integrations/catalog')),

    // ── SaaS ──────────────────────────────────────────────────────────────
    p('saas-overview', 'SaaS Platform', 'SaaS', q('/admin/saas')),
    p('saas-stores', 'Stores', 'SaaS', q('/admin/saas/stores')),

    // ── Security (one probe per admin nav item) ───────────────────────────
    p('security-center', 'Security Center', 'Security', q('/admin/security')),
    p('security-admin-users', 'Admin Users', 'Security', q('/admin/security/staff')),
    p('security-roles', 'Roles', 'Security', q('/admin/security/staff')),
    p('security-permissions', 'Permissions', 'Security', q('/admin/security/2fa/status')),
    p('security-audit', 'Audit Logs', 'Security', q('/admin/security/audit-logs') + '&limit=5'),

    // ── System ────────────────────────────────────────────────────────────
    p('platform-system-logs', 'Application Logs', 'System', q('/admin/platform/system-logs') + '&limit=5'),
    p('platform-telegram-logs', 'Telegram Logs', 'System', q('/admin/platform/telegram-logs') + '&limit=5'),

    // ── Storefront (customer-facing API) ──────────────────────────────────
    p('storefront-settings', 'Storefront Settings', 'Storefront', q('/storefront/settings')),
    p('storefront-products', 'Storefront Products', 'Storefront', q('/storefront/products')),
    p('storefront-banners', 'Storefront Banners', 'Storefront', q('/storefront/banners')),
  ]
}

export const API_ROUTE_COUNT = buildApiRouteProbes().length
