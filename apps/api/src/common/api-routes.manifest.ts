/** Pingable routes for live health monitoring (storeId=splaro substituted at runtime). */
export type HttpProbeMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export type ProbeFeatureFlag = 'loyalty' | 'saas' | 'vendor' | 'ai' | 'chatbot' | 'googleSheets'

export interface ApiRouteProbe {
  id: string
  name: string
  group: string
  path: string
  /** 2xx or expected 404 = healthy (GET probes) */
  allowNotFound?: boolean
  /** GET routes that require customer/session auth — 401 still means route exists */
  allowUnauthorized?: boolean
  /**
   * When this feature flag is OFF, probe is counted healthy (expected 403).
   * Prevents “Customers 5/11 OK” noise for intentionally disabled SaaS modules.
   */
  requiresFeature?: ProbeFeatureFlag
  /** Default GET. POST/PUT/PATCH/DELETE use writeProbe semantics unless overridden. */
  method?: HttpProbeMethod
  /** JSON body for write probes (default `{}`). */
  body?: string
  /** When true, 400/401/403/422 count as healthy (route registered). */
  writeProbe?: boolean
}

function p(
  id: string,
  name: string,
  group: string,
  path: string,
  opts?: {
    allowNotFound?: boolean
    allowUnauthorized?: boolean
    requiresFeature?: ProbeFeatureFlag
  },
): ApiRouteProbe {
  return { id, name, group, path, ...opts }
}

function pw(
  id: string,
  name: string,
  group: string,
  path: string,
  body = '{}',
  opts?: { requiresFeature?: ProbeFeatureFlag },
): ApiRouteProbe {
  return { id, name, group, path, method: 'POST', body, writeProbe: true, ...opts }
}

function pwp(
  id: string,
  name: string,
  group: string,
  path: string,
  body = '{}',
  opts?: { requiresFeature?: ProbeFeatureFlag },
): ApiRouteProbe {
  return { id, name, group, path, method: 'PATCH', body, writeProbe: true, ...opts }
}

export function buildApiRouteProbes(storeId = 'splaro'): ApiRouteProbe[] {
  const sid = encodeURIComponent(storeId)
  const q = (path: string) => `${path}${path.includes('?') ? '&' : '?'}storeId=${sid}`

  return [
    // ── Core ──────────────────────────────────────────────────────────────
    p('health', 'Health', 'Core', '/health'),
    p('health-full', 'Full Diagnostics', 'Core', '/health/full'),
    p('api-index', 'API Index', 'Core', '/'),

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
    p('dash-recent-orders', 'Recent Orders', 'Overview', q('/admin/dashboard/recent-orders') + '&limit=5'),
    p('dash-revenue-chart', 'Revenue Chart', 'Overview', q('/admin/dashboard/revenue-chart')),
    p('dash-orders-status', 'Orders by Status', 'Overview', q('/admin/dashboard/orders-by-status')),
    p('dash-top-products', 'Top Products (Dash)', 'Overview', q('/admin/dashboard/top-products')),
    p('dash-action-required', 'Action Required', 'Overview', q('/admin/dashboard/action-required')),
    p('analytics-insights', 'Analytics Insights', 'Overview', q('/admin/analytics/insights')),
    p('analytics-top-products', 'Top Products', 'Overview', q('/admin/analytics/top-products')),
    p('analytics-cohorts', 'Customer Cohorts', 'Overview', q('/admin/analytics/customer-cohorts')),
    p('analytics-traffic', 'Traffic', 'Overview', q('/admin/analytics/traffic')),
    p('analytics-inventory', 'Inventory Health', 'Overview', q('/admin/analytics/inventory-health')),
    p('analytics-funnel', 'Conversion Funnel', 'Overview', q('/admin/analytics/funnel')),

    // ── Commerce ──────────────────────────────────────────────────────────
    p('orders', 'Orders', 'Commerce', q('/admin/orders') + '&limit=5'),
    p('pos', 'POS', 'Commerce', q('/admin/pos/today')),
    p('rma', 'Returns / RMA', 'Commerce', q('/admin/commerce-finance/returns') + '&limit=5'),
    p('commerce-invoices', 'Invoices', 'Commerce', q('/admin/commerce-finance/invoices') + '&limit=5'),
    p('commerce-transactions', 'Transactions', 'Commerce', q('/admin/commerce-finance/transactions') + '&limit=5'),
    p('admin-invoices', 'Invoice PDF Service', 'Commerce', q('/admin/invoices/health')),
    p('hub-subscriptions', 'Subscriptions', 'Commerce', q('/admin/hub/commerce/subscriptions')),
    p('commerce-tx-health', 'Transactions Health', 'Commerce', q('/admin/commerce-finance/transactions/health')),
    p('rma-stats', 'RMA Stats', 'Commerce', q('/admin/rma/stats')),
    p('rma-list', 'RMA List', 'Commerce', q('/admin/rma') + '&limit=5'),
    p('pos-catalog', 'POS Catalog', 'Commerce', q('/admin/pos/catalog')),
    p('print-jobs', 'Print Jobs', 'Commerce', q('/admin/print/jobs') + '&limit=5'),
    p('print-jobs-stats', 'Print Job Stats', 'Commerce', q('/admin/print/jobs/stats')),
    p('invoices-list', 'Invoice List', 'Commerce', q('/admin/invoices') + '&limit=5'),
    p('invoices-stats', 'Invoice Stats', 'Commerce', q('/admin/invoices/stats/overview')),

    // ── Catalog ───────────────────────────────────────────────────────────
    p('products', 'Products', 'Catalog', q('/admin/products') + '&limit=5'),
    p('categories', 'Categories', 'Catalog', q('/admin/categories')),
    p('collections', 'Collections', 'Catalog', q('/admin/collections')),
    p('brands', 'Brands', 'Catalog', q('/admin/brands')),
    p('inventory-alerts', 'Inventory Alerts', 'Catalog', q('/admin/dashboard/inventory-alerts')),
    p('search', 'Product Search', 'Catalog', `/search?q=shirt&storeId=${sid}`),
    p('search-suggest', 'Search Suggest', 'Catalog', `/search/suggest?q=shirt&storeId=${sid}`),
    p('search-config', 'Search Config', 'Catalog', `/search/config/${sid}`),
    p('search-analytics', 'Search Analytics', 'Catalog', `/search/analytics/${sid}/popular`),
    p('product-reviews', 'Product Reviews', 'Catalog', q('/admin/products/reviews') + '&limit=5'),
    p('redirects', 'URL Redirects', 'Catalog', q('/admin/redirects')),
    p('banner-stats', 'Banner Stats', 'Catalog', q('/admin/banners/stats')),
    p('settings-catalog-stats', 'Catalog Stats', 'Catalog', q('/admin/settings/catalog-stats')),
    p('coupons-active', 'Active Coupons', 'Catalog', q('/storefront/coupons/active')),
    p('coupons-availability', 'Promo Availability', 'Catalog', q('/storefront/promos/availability')),

    // ── Customers ─────────────────────────────────────────────────────────
    p('customers', 'Customers', 'Customers', q('/admin/customers') + '&limit=5'),
    p('loyalty-summary', 'Loyalty Program', 'Customers', q('/admin/loyalty/summary'), { requiresFeature: 'loyalty' }),
    p('loyalty-referrals', 'Referrals', 'Customers', q('/admin/loyalty/referrals') + '&limit=5', { requiresFeature: 'loyalty' }),
    p('loyalty-history', 'Loyalty History', 'Customers', q('/admin/loyalty/history'), { requiresFeature: 'loyalty' }),
    p('loyalty-tiers', 'Loyalty Tiers', 'Customers', q('/admin/loyalty/tiers'), { requiresFeature: 'loyalty' }),
    p('loyalty-tier-analytics', 'Tier Analytics', 'Customers', q('/admin/loyalty/tier-analytics'), { requiresFeature: 'loyalty' }),
    p('loyalty-referral-stats', 'Referral Stats', 'Customers', q('/admin/loyalty/referrals/stats'), { requiresFeature: 'loyalty' }),
    p('customers-export', 'Customer Export', 'Customers', q('/admin/customers/export')),
    p('customers-cod-risk', 'COD Risk Stats', 'Customers', q('/admin/customers/cod-risk/stats')),

    // ── Marketing ─────────────────────────────────────────────────────────
    p('marketing-campaigns', 'Campaigns', 'Marketing', q('/marketing/campaigns')),
    p('coupons', 'Coupons', 'Marketing', q('/admin/coupons')),
    p('marketing-subscribers', 'Email & SMS Subscribers', 'Marketing', q('/marketing/subscribers') + '&limit=5'),
    p('hub-marketing', 'Marketing Overview', 'Marketing', q('/admin/hub/marketing/overview')),
    p('marketing-campaign-stats', 'Campaign Stats', 'Marketing', q('/marketing/campaigns/stats')),
    p('marketing-push-subs', 'Push Subscribers', 'Marketing', q('/marketing/push/subscribers')),

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
    p('content-overview', 'Content Overview', 'Content', q('/admin/content/overview')),
    p('content-blog-categories', 'Blog Categories', 'Content', q('/admin/content/blog-categories')),

    // ── SEO Center ────────────────────────────────────────────────────────
    p('seo-overview', 'SEO Health', 'SEO Center', q('/admin/hub/seo/overview')),
    p('seo-sitemap', 'Sitemap Manager', 'SEO Center', q('/admin/hub/seo/overview')),
    p('seo-audit', 'Product SEO Audit', 'SEO Center', q('/admin/hub/seo/overview')),
    p('hub-seo', 'SEO Hub Overview', 'SEO Center', q('/admin/hub/seo/overview')),
    p('seo-api-overview', 'SEO API Overview', 'SEO Center', q('/seo/overview')),
    p('seo-audit-products', 'SEO Product Audit', 'SEO Center', q('/seo/audit/products')),
    p('seo-schema-org', 'Schema Organization', 'SEO Center', q('/seo/schema/organization')),
    p('seo-schema-breadcrumb', 'Schema Breadcrumb', 'SEO Center', q('/seo/schema/breadcrumb') + '&path=/products'),

    // ── AI Center ─────────────────────────────────────────────────────────
    p('agent-status', 'AI Command Brain', 'AI Center', q('/agent/status')),
    p('agent-health', 'AI Agent Health', 'AI Center', q('/agent/health')),
    p('ai-jobs', 'AI Product Generator', 'AI Center', q('/ai-product-agent/jobs') + '&limit=5'),
    p('agent-config', 'Agent Config', 'AI Center', q('/agent/config')),
    p('agent-prompts', 'Agent Prompts', 'AI Center', q('/agent/prompts')),

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
    p('finance-profit-yearly', 'P&L Yearly', 'Finance', q('/profit-loss/yearly')),
    p('finance-reports-revenue-daily', 'Report Revenue Daily', 'Finance', q('/finance-reports/revenue/daily')),
    p('finance-reports-revenue-payment', 'Report Revenue by Payment', 'Finance', q('/finance-reports/revenue/by-payment')),
    p('finance-reports-revenue-district', 'Report Revenue by District', 'Finance', q('/finance-reports/revenue/by-district')),
    p('finance-reports-orders', 'Report Orders Summary', 'Finance', q('/finance-reports/orders/summary')),
    p('finance-reports-top-selling', 'Report Top Selling', 'Finance', q('/finance-reports/products/top-selling')),
    p('finance-reports-slow-moving', 'Report Slow Moving', 'Finance', q('/finance-reports/products/slow-moving')),
    p('finance-reports-customer-growth', 'Report Customer Growth', 'Finance', q('/finance-reports/customers/growth')),
    p('finance-reports-top-spenders', 'Report Top Spenders', 'Finance', q('/finance-reports/customers/top-spenders')),
    p('finance-reports-inventory-val', 'Report Inventory Valuation', 'Finance', q('/finance-reports/inventory/valuation')),
    p('finance-reports-inventory-mov', 'Report Inventory Movements', 'Finance', q('/finance-reports/inventory/movements')),
    p('google-sheets-logs', 'Google Sheets Logs', 'Finance', q('/google-sheets/logs') + '&limit=5'),

    // ── Automation ────────────────────────────────────────────────────────
    p('automation-rules', 'Automation Rules', 'Automation', q('/automation/rules')),
    p('automation-logs', 'Automation Logs', 'Automation', q('/automation/logs') + '&limit=5'),
    p('integrations-telegram', 'Telegram Notifications', 'Automation', q('/admin/integrations/telegram')),
    p('integrations-google-sheets', 'Google Sheets Sync', 'Automation', q('/admin/integrations/google-sheets/status')),
    p('integrations-ai', 'AI Product Agent Config', 'Automation', q('/admin/integrations/ai')),
    p('automation-stats', 'Automation Stats', 'Automation', q('/automation/stats')),
    p('integrations-payments', 'Payment Integrations', 'Automation', q('/admin/integrations/payments')),
    p('integrations-gs-syncs', 'Sheets Sync Jobs', 'Automation', q('/admin/integrations/google-sheets/syncs')),

    // ── WMS ───────────────────────────────────────────────────────────────
    p('commerce-wms', 'WMS Overview', 'WMS', q('/commerce-os/wms/overview')),
    p('wms-warehouses', 'Warehouses', 'WMS', q('/commerce-os/wms/warehouses')),
    p('wms-movements', 'Stock Movements', 'WMS', q('/commerce-os/wms/movements')),
    p('wms-transfers', 'Stock Transfers', 'WMS', q('/commerce-os/wms/overview')),
    pw('wms-movements-post', 'Record Movement (POST)', 'WMS', q('/commerce-os/wms/movements')),
    pw('wms-transfers-post', 'Create Transfer (POST)', 'WMS', q('/commerce-os/wms/transfers')),
    pw('wms-warehouse-post', 'Create Warehouse (POST)', 'WMS', q('/commerce-os/wms/warehouses')),
    pw('wms-transfer-ship-post', 'Ship Transfer (POST)', 'WMS', q('/commerce-os/wms/transfers/health-probe/ship')),
    pw('wms-transfer-receive-post', 'Receive Transfer (POST)', 'WMS', q('/commerce-os/wms/transfers/health-probe/receive')),

    // ── Procurement ───────────────────────────────────────────────────────
    p('procurement-overview', 'Procurement Overview', 'Procurement', q('/commerce-os/procurement/overview')),
    p('procurement-suppliers', 'Suppliers', 'Procurement', q('/commerce-os/procurement/suppliers')),
    p('procurement-po', 'Purchase Orders', 'Procurement', q('/commerce-os/procurement/purchase-orders')),
    p('procurement-grn', 'Goods Received', 'Procurement', q('/commerce-os/procurement/grns')),
    pw('procurement-grn-post', 'Receive Goods GRN (POST)', 'Procurement', q('/admin/hub/procurement/goods-received'), '{"purchaseOrderId":"health-probe"}'),

    // ── Production ────────────────────────────────────────────────────────
    p('production-overview', 'Production Overview', 'Production', q('/commerce-os/production/overview')),
    p('production-fabrics', 'Fabric Inventory', 'Production', q('/commerce-os/production/fabrics')),
    p('production-batches', 'Production Batches', 'Production', q('/commerce-os/production/batches')),
    pw('production-fabric-post', 'Create Fabric (POST)', 'Production', q('/commerce-os/production/fabrics')),
    pw('production-batch-post', 'Create Batch (POST)', 'Production', q('/commerce-os/production/batches')),
    pwp('production-fabric-stock-patch', 'Adjust Fabric Stock (PATCH)', 'Production', q('/commerce-os/production/fabrics/health-probe/stock'), '{"delta":0}'),

    // ── Support ───────────────────────────────────────────────────────────
    p('support-helpdesk', 'Helpdesk', 'Support', q('/commerce-os/helpdesk/overview')),
    p('support-tickets', 'Support Tickets', 'Support', q('/commerce-os/helpdesk/tickets')),
    pw('support-ticket-reply-post', 'Ticket Reply (POST)', 'Support', q('/commerce-os/helpdesk/tickets/health-probe/reply'), '{"message":"health probe"}'),
    pw('hub-support-ticket-post', 'Create Ticket (POST)', 'Support', q('/admin/hub/support/tickets')),

    // ── Delivery ──────────────────────────────────────────────────────────
    p('delivery-overview', 'Delivery Overview', 'Delivery', q('/commerce-os/delivery/overview')),
    p('delivery-agents', 'Delivery Agents', 'Delivery', q('/commerce-os/delivery/agents')),
    p('delivery-assignments', 'Assignments', 'Delivery', q('/commerce-os/delivery/assignments')),
    pw('delivery-agent-post', 'Create Agent (POST)', 'Delivery', q('/commerce-os/delivery/agents')),
    pw('delivery-assignment-post', 'Assign Order (POST)', 'Delivery', q('/commerce-os/delivery/assignments')),
    pwp('delivery-agent-patch', 'Update Agent (PATCH)', 'Delivery', q('/commerce-os/delivery/agents/health-probe')),
    pwp('delivery-assignment-status-patch', 'Update Assignment (PATCH)', 'Delivery', q('/commerce-os/delivery/assignments/health-probe/status'), '{"status":"PENDING"}'),

    // ── Company OS ────────────────────────────────────────────────────────
    p('commerce-company', 'Company Dashboard', 'Company OS', q('/commerce-os/company/overview')),
    p('company-employees', 'Employees', 'Company OS', q('/commerce-os/company/employees')),
    pw('company-employee-post', 'Create Employee (POST)', 'Company OS', q('/commerce-os/company/employees')),
    pwp('company-employee-patch', 'Update Employee (PATCH)', 'Company OS', q('/commerce-os/company/employees/health-probe')),
    pw('company-task-post', 'Create Task (POST)', 'Company OS', q('/commerce-os/company/tasks')),
    pwp('company-task-status-patch', 'Update Task Status (PATCH)', 'Company OS', q('/commerce-os/company/tasks/health-probe/status'), '{"status":"TODO"}'),
    p('company-payroll-runs', 'Payroll Runs', 'Company OS', q('/commerce-os/company/payroll/runs')),
    pw('company-payroll-run-post', 'Create Payroll Run (POST)', 'Company OS', q('/commerce-os/company/payroll/runs')),

    // ── Operations ────────────────────────────────────────────────────────
    p('courier-stats', 'Courier Hub', 'Operations', q('/admin/courier/stats/overview')),
    p('courier-list', 'Courier Bookings', 'Operations', q('/admin/courier') + '&limit=5'),
    p('settings', 'Shipping & Settings', 'Operations', q('/admin/settings')),

    // ── Media ─────────────────────────────────────────────────────────────
    p('platform-media', 'Media Library', 'Media', q('/admin/platform/media')),

    // ── Marketplace ───────────────────────────────────────────────────────
    p('platform-marketplace', 'Marketplace Overview', 'Marketplace', q('/admin/platform/marketplace'), {
      requiresFeature: 'vendor',
    }),

    // ── Social Commerce ───────────────────────────────────────────────────
    p('marketing-social', 'Social Hub', 'Social Commerce', q('/admin/hub/marketing/overview')),

    // ── Developer ─────────────────────────────────────────────────────────
    p('platform-developer', 'API Developer Center', 'Developer', q('/admin/platform/developer')),
    p('webhooks', 'Webhooks', 'Developer', q('/admin/webhooks')),
    p('webhooks-logs', 'Webhook Logs', 'Developer', q('/admin/webhooks/logs') + '&limit=5'),
    p('webhooks-stats', 'Webhook Stats', 'Developer', q('/admin/webhooks/stats')),
    p('webhooks-events', 'Webhook Events', 'Developer', q('/admin/webhooks/events')),

    // ── Observability ─────────────────────────────────────────────────────
    p('platform-observability', 'Observability Center', 'Observability', q('/admin/platform/observability')),

    // ── Google Workspace ──────────────────────────────────────────────────
    p('google-status', 'Google Workspace', 'Google Workspace', q('/admin/google/status')),
    p('google-sheets-config', 'Sheets Sync Config', 'Google Workspace', q('/admin/google/sheets/config')),
    p('google-gmail-config', 'Gmail Config', 'Google Workspace', q('/admin/google/gmail/config')),
    p('google-sync-logs', 'Sync Logs', 'Google Workspace', q('/admin/google/sync-logs') + '&limit=5'),
    p('google-oauth-url', 'OAuth URL', 'Google Workspace', q('/admin/google/oauth-url')),
    p('google-audit-logs', 'Google Audit Logs', 'Google Workspace', q('/admin/google/audit-logs') + '&limit=5'),

    // ── Integrations ──────────────────────────────────────────────────────
    p('integrations-list', 'All Integrations', 'Integrations', q('/admin/integrations')),
    p('integrations-health', 'Integration Health', 'Integrations', q('/admin/integrations/health')),
    p('integrations-catalog', 'Integration Catalog', 'Integrations', q('/admin/integrations/catalog')),

    // ── SaaS ──────────────────────────────────────────────────────────────
    p('saas-overview', 'SaaS Platform', 'SaaS', q('/admin/saas'), { requiresFeature: 'saas' }),
    p('saas-stores', 'Stores', 'SaaS', q('/admin/saas/stores'), { requiresFeature: 'saas' }),
    p('saas-subscription', 'Subscription', 'SaaS', q('/admin/saas/subscription'), { requiresFeature: 'saas' }),
    p('saas-stats', 'SaaS Stats', 'SaaS', q('/admin/saas/stats'), { requiresFeature: 'saas' }),
    p('saas-loyalty-tiers', 'SaaS Loyalty Tiers', 'SaaS', q('/admin/saas/loyalty/tiers'), { requiresFeature: 'saas' }),

    // ── Security (one probe per admin nav item) ───────────────────────────
    p('security-center', 'Security Center', 'Security', q('/admin/security')),
    p('security-admin-users', 'Admin Users', 'Security', q('/admin/security/staff')),
    p('security-roles', 'Roles', 'Security', q('/admin/security/staff')),
    p('security-permissions', 'Permissions', 'Security', q('/admin/security/permissions')),
    p('security-audit', 'Audit Logs', 'Security', q('/admin/security/audit-logs') + '&limit=5'),
    p('security-database', 'Database Security', 'Security', q('/admin/security/database')),
    p('security-sessions', 'Active Sessions', 'Security', q('/admin/security/sessions')),
    p('security-ip-rules', 'IP Rules', 'Security', q('/admin/security/ip-rules')),
    p('security-login-history', 'Login History', 'Security', q('/admin/security/login-history') + '&limit=5'),
    p('security-login-stats', 'Login Stats', 'Security', q('/admin/security/login-history/stats')),
    p('security-fraud-alerts', 'Fraud Alerts', 'Security', q('/admin/security/fraud/alerts')),
    p('security-2fa', '2FA Status', 'Security', q('/admin/security/2fa/status')),
    p('admin-auth-me', 'Admin Session', 'Security', q('/admin/auth/me'), { allowUnauthorized: true }),

    // ── System ────────────────────────────────────────────────────────────
    p('platform-system-logs', 'Application Logs', 'System', q('/admin/platform/system-logs') + '&limit=5'),
    p('platform-telegram-logs', 'Telegram Logs', 'System', q('/admin/platform/telegram-logs') + '&limit=5'),
    p('notifications-log', 'Notification Log', 'System', q('/admin/notifications/log') + '&limit=5'),
    p('notifications-prefs', 'Notification Prefs', 'System', q(`/admin/notifications/preferences/${sid}`)),
    p('notifications-low-stock', 'Low Stock Alerts', 'System', q('/admin/notifications/low-stock')),
    p('settings-newsletter', 'Newsletter Subscribers', 'System', q('/admin/settings/newsletter-subscribers')),

    // ── Storefront (customer-facing API) ──────────────────────────────────
    p('storefront-settings', 'Storefront Settings', 'Storefront', q('/storefront/settings')),
    p('storefront-products', 'Storefront Products', 'Storefront', q('/storefront/products')),
    p('storefront-banners', 'Storefront Banners', 'Storefront', q('/storefront/banners')),
    p('storefront-categories', 'Storefront Categories', 'Storefront', q('/storefront/categories')),
    p('storefront-collections', 'Storefront Collections', 'Storefront', q('/storefront/collections')),
    p('storefront-menu', 'Storefront Menu', 'Storefront', q('/storefront/menu/main')),
    p('storefront-search', 'Storefront Search', 'Storefront', q('/storefront/search') + '&q=shirt'),
    p('storefront-reviews', 'Storefront Reviews', 'Storefront', q('/storefront/reviews')),
    p('storefront-redirects', 'Storefront Redirects', 'Storefront', q('/storefront/redirects')),
    p('storefront-auth-me', 'Storefront Auth Me', 'Storefront', q('/storefront/auth/me'), { allowUnauthorized: true }),
    p('storefront-track-order', 'Order Tracking', 'Storefront', q('/storefront/orders/track') + '&phone=01700000000', {
      allowUnauthorized: true,
    }),
    // Write probes must NOT mutate live data or fire Telegram/email.
    // Intentionally invalid bodies → 400 (route registered) without side effects.
    pw('storefront-newsletter-post', 'Newsletter Subscribe (POST)', 'Storefront', q('/storefront/newsletter/subscribe'), '{"email":"not-an-email"}'),
    pw('storefront-contact-post', 'Contact Form (POST)', 'Storefront', q('/storefront/contact'), '{"name":"Health Probe","contact":"probe@invalid","message":"route health probe body"}'),
    pw('procurement-supplier-post', 'Create Supplier (POST)', 'Procurement', q('/admin/hub/procurement/suppliers')),
    pw('procurement-po-post', 'Create PO (POST)', 'Procurement', q('/admin/hub/procurement/purchase-orders')),
    pw('marketing-affiliate-post', 'Create Affiliate (POST)', 'Marketing', q('/admin/hub/marketing/affiliates')),
    pw('commerce-return-post', 'Create Return (POST)', 'Commerce', q('/admin/commerce-finance/returns')),
    pw('pos-sale-post', 'POS Sale (POST)', 'Commerce', q('/admin/pos/sale')),
    pw('automation-rule-post', 'Create Rule (POST)', 'Automation', q('/automation/rules')),
    pw('webhook-post', 'Register Webhook (POST)', 'Developer', q('/admin/webhooks')),
    pw('product-post', 'Create Product (POST)', 'Catalog', q('/admin/products')),
    pw('order-post', 'Create Order (POST)', 'Commerce', q('/admin/orders')),
    pw('customer-note-post', 'Customer Note (POST)', 'Customers', q('/admin/customers/health-probe/notes'), '{"note":"health probe"}'),
    pw('loyalty-tier-post', 'Upsert Loyalty Tier (POST)', 'Customers', q('/admin/loyalty/tiers'), '{"tier":"BRONZE","minPoints":0,"pointsPerBdt":1}', {
      requiresFeature: 'loyalty',
    }),
    pw('campaign-post', 'Create Campaign (POST)', 'Marketing', q('/marketing/campaigns')),
    pw('coupon-post', 'Create Coupon (POST)', 'Marketing', q('/admin/coupons')),
    pw('blog-post', 'Create Blog Post (POST)', 'Content', q('/admin/hub/content/blog')),
  ]
}

export const API_ROUTE_COUNT = buildApiRouteProbes().length
