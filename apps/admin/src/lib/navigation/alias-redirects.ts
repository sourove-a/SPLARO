/**
 * Legacy / duplicate admin URLs → primary DC screens.
 * Checked before nav resolve so bookmarks work even after items are removed
 * from `adminNavGroups`.
 */
export const ALIAS_REDIRECTS: Record<string, string> = {
  // Overview duplicates
  '/dashboard/revenue-center': '/dashboard',
  '/dashboard/executive/ceo-dashboard': '/dashboard',
  '/dashboard/business-intelligence': '/dashboard/analytics',

  // Finance tabs inside Partner Hub / Sheets
  '/dashboard/finance/investments': '/dashboard/finance/partner-accounts',
  '/dashboard/finance/withdrawals': '/dashboard/finance/partner-accounts',
  '/dashboard/finance/google-sheets-finance': '/dashboard/automation/google-sheets-sync',

  // Ops aliases
  '/dashboard/shipping': '/dashboard/courier-hub',
  '/dashboard/warehouse': '/dashboard/wms/overview',
  '/dashboard/supplier-management': '/dashboard/procurement/suppliers',
  '/dashboard/wms/warehouses': '/dashboard/wms/overview',
  '/dashboard/wms/transfers': '/dashboard/wms/overview',
  '/dashboard/wms/stock-movements': '/dashboard/inventory',

  // AI / automation stubs → live hubs
  '/dashboard/automation/telegram-notifications': '/dashboard/telegram-bot',
  '/dashboard/automation/ai-product-agent': '/dashboard/ai-agent',
  '/dashboard/automation/ai-seo-agent': '/dashboard/ai-agent',
  '/dashboard/automation/ai-sales-insights': '/dashboard/ai-agent',
  '/dashboard/ai-content': '/dashboard/ai-agent',
  '/dashboard/ai-seo': '/dashboard/ai-agent',
  '/dashboard/ai-analytics': '/dashboard/ai-agent',
  '/dashboard/ai-sales': '/dashboard/ai-agent',
  '/dashboard/ai-customer-insights': '/dashboard/ai-agent',
  '/dashboard/ai-product-generator': '/dashboard/ai-agent',
  '/dashboard/manus': '/dashboard/ai-agent',

  // Media shells
  '/dashboard/video-library': '/dashboard/media-library',
  '/dashboard/ugc-gallery': '/dashboard/media-library',

  // Catalog util duplicates
  '/dashboard/sku-manager': '/dashboard/products',
  '/dashboard/qr-manager': '/dashboard/products',
  '/dashboard/barcode-manager': '/dashboard/products',
  '/dashboard/attributes': '/dashboard/categories',

  // SEO sub-tools
  '/dashboard/keywords': '/dashboard/seo-health',
  '/dashboard/index-monitor': '/dashboard/seo-health',
  '/dashboard/schema-manager': '/dashboard/seo-health',
  '/dashboard/sitemap-manager': '/dashboard/seo-health',
  '/dashboard/redirect-manager': '/dashboard/seo-health',

  // Integrations
  '/dashboard/email-sms': '/dashboard/sms',
  '/dashboard/meta-business': '/dashboard/all-integrations',
  '/dashboard/google-merchant': '/dashboard/all-integrations',
  '/dashboard/whatsapp': '/dashboard/sms',

  // Google Workspace shells → live connect / sheets / SEO / integrations
  '/dashboard/google-workspace': '/dashboard/google-workspace/connect',
  '/dashboard/google-workspace/sheets-sync': '/dashboard/automation/google-sheets-sync',
  '/dashboard/google-workspace/docs': '/dashboard/automation/google-sheets-sync',
  '/dashboard/google-workspace/calendar': '/dashboard/automation/google-sheets-sync',
  '/dashboard/google-workspace/contacts': '/dashboard/automation/google-sheets-sync',
  '/dashboard/google-workspace/analytics': '/dashboard/seo-health',
  '/dashboard/google-workspace/search-console': '/dashboard/seo-health',
  '/dashboard/google-workspace/merchant-center': '/dashboard/all-integrations',
  '/dashboard/system/sync-logs': '/dashboard/google-workspace/sync-logs',

  // Security aliases
  '/dashboard/roles': '/dashboard/admin-users',
  '/dashboard/permissions': '/dashboard/admin-users',
  '/dashboard/audit-logs': '/dashboard/security-center',
  '/dashboard/system/telegram-logs': '/dashboard/telegram-bot',
  '/dashboard/system-health': '/dashboard/api-health',

  // Hub child URLs → hub roots
  '/dashboard/production/fabric-inventory': '/dashboard/production/overview',
  '/dashboard/delivery/assignments': '/dashboard/delivery/agents',
  '/dashboard/company/employees': '/dashboard/company/dashboard',
  '/dashboard/company/payroll': '/dashboard/company/dashboard',
  '/dashboard/company/tasks': '/dashboard/company/dashboard',
  '/dashboard/company/documents': '/dashboard/company/dashboard',
  '/dashboard/support/live-chat': '/dashboard/support/helpdesk',
  '/dashboard/system/finance-audit-logs': '/dashboard/logs',

  // Removed stubs — nearest live surface (bookmark-safe, never soft-lock)
  '/dashboard/stores': '/dashboard',
  '/dashboard/saas-subscriptions': '/dashboard',
  '/dashboard/domains': '/dashboard',
  '/dashboard/tenants': '/dashboard',
  '/dashboard/billing': '/dashboard',
  '/dashboard/marketplace/overview': '/dashboard',
  '/dashboard/social-commerce/hub': '/dashboard/campaigns',
  '/dashboard/theme-builder': '/dashboard/branding',
  '/dashboard/backups': '/dashboard/api-health',
  '/dashboard/influencers': '/dashboard/campaigns',
  '/dashboard/segments': '/dashboard/customers',
  '/dashboard/customer-intelligence': '/dashboard/customers',
  '/dashboard/vip-members': '/dashboard/customers',
  '/dashboard/loyalty-program': '/dashboard/customers',
  '/dashboard/referrals': '/dashboard/campaigns',
  '/dashboard/affiliate': '/dashboard/campaigns',
}

/** Resolve longest matching alias for a dashboard slug path. */
export function resolveAliasRedirect(slug: string[] | undefined): string | null {
  if (!slug?.length) return null
  const current = `/dashboard/${slug.join('/')}`

  for (let depth = slug.length; depth >= 1; depth -= 1) {
    const href = `/dashboard/${slug.slice(0, depth).join('/')}`
    const target = ALIAS_REDIRECTS[href]
    if (!target) continue

    // Exact hit always wins.
    if (depth === slug.length) {
      return target === current ? null : target
    }

    /*
     * Shallower hits are the "bookmark to a removed parent" fallback, but a
     * parent alias must not swallow its own children. '/dashboard/
     * google-workspace' redirects to '/dashboard/google-workspace/connect',
     * so the prefix walk sent /connect straight back to itself — an infinite
     * redirect that rendered a blank page, and sent every sibling (/gmail,
     * /drive, /sync-logs) to /connect instead of their own screen.
     *
     * When the target lives under the same parent, the deeper path is a real
     * route and must be left alone.
     */
    if (target === current || target.startsWith(`${href}/`)) continue

    return target
  }

  return null
}
