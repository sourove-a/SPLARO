/**
 * Smoke: former NAV_HIDDEN hrefs each have an alias OR appear in REGISTERED_MODULE_HREFS.
 * NAV_HIDDEN_HREFS must be empty.
 *
 * Run: node scripts/smoke-admin-nav-live.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const FORMER_HIDDEN = [
  '/dashboard/warehouse',
  '/dashboard/supplier-management',
  '/dashboard/revenue-center',
  '/dashboard/business-intelligence',
  '/dashboard/executive/ceo-dashboard',
  '/dashboard/pos',
  '/dashboard/invoices',
  '/dashboard/transactions',
  '/dashboard/subscriptions',
  '/dashboard/finance/expenses',
  '/dashboard/finance/investments',
  '/dashboard/finance/withdrawals',
  '/dashboard/finance/google-sheets-finance',
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
  '/dashboard/shipping',
  '/dashboard/automation/telegram-notifications',
  '/dashboard/automation/ai-product-agent',
  '/dashboard/automation/ai-seo-agent',
  '/dashboard/automation/ai-sales-insights',
  '/dashboard/webhooks',
  '/dashboard/meta-business',
  '/dashboard/google-merchant',
  '/dashboard/video-library',
  '/dashboard/ugc-gallery',
  '/dashboard/ai-content',
  '/dashboard/ai-seo',
  '/dashboard/ai-analytics',
  '/dashboard/ai-sales',
  '/dashboard/ai-customer-insights',
  '/dashboard/ai-product-generator',
  '/dashboard/email-sms',
  '/dashboard/whatsapp',
  '/dashboard/influencers',
  '/dashboard/affiliate',
  '/dashboard/referrals',
  '/dashboard/segments',
  '/dashboard/customer-intelligence',
  '/dashboard/sku-manager',
  '/dashboard/qr-manager',
  '/dashboard/barcode-manager',
  '/dashboard/brands',
  '/dashboard/attributes',
  '/dashboard/vip-members',
  '/dashboard/loyalty-program',
  '/dashboard/keywords',
  '/dashboard/index-monitor',
  '/dashboard/schema-manager',
  '/dashboard/sitemap-manager',
  '/dashboard/redirect-manager',
  '/dashboard/roles',
  '/dashboard/permissions',
  '/dashboard/audit-logs',
  '/dashboard/backups',
  '/dashboard/logs',
  '/dashboard/system-health',
  '/dashboard/system/sync-logs',
  '/dashboard/system/telegram-logs',
  '/dashboard/system/finance-audit-logs',
]

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

function extractStringArray(src, exportName) {
  const re = new RegExp(`export const ${exportName}[^=]*=\\s*\\[([\\s\\S]*?)\\]`, 'm')
  const m = src.match(re)
  if (!m) throw new Error(`Could not find ${exportName}`)
  return [...m[1].matchAll(/'(\/dashboard[^']*)'/g)].map((x) => x[1])
}

function extractAliasKeys(src) {
  const m = src.match(/export const ALIAS_REDIRECTS[^=]*=\s*\{([\s\S]*?)\}/m)
  if (!m) throw new Error('Could not find ALIAS_REDIRECTS')
  return [...m[1].matchAll(/'(\/dashboard[^']*)'\s*:/g)].map((x) => x[1])
}

function navHiddenIsEmpty(src) {
  return /export const NAV_HIDDEN_HREFS\s*=\s*new Set<string>\(\s*\[\s*\]\s*\)/.test(src)
}

const aliasKeys = new Set(extractAliasKeys(read('apps/admin/src/lib/navigation/alias-redirects.ts')))
const registered = new Set(extractStringArray(read('apps/admin/src/lib/modules/registry.ts'), 'REGISTERED_MODULE_HREFS'))
const navSrc = read('apps/admin/src/lib/navigation/admin-nav.ts')

if (!navHiddenIsEmpty(navSrc)) {
  console.error('FAIL: NAV_HIDDEN_HREFS is not empty')
  process.exit(1)
}

const pageSrc = read('apps/admin/src/app/dashboard/[...slug]/page.tsx')
if (pageSrc.includes('DcLiveModuleScreen')) {
  console.error('FAIL: DcLiveModuleScreen still referenced in catch-all page')
  process.exit(1)
}

const failures = []
for (const href of FORMER_HIDDEN) {
  if (aliasKeys.has(href) || registered.has(href)) continue
  failures.push(href)
}

if (failures.length) {
  console.error(`FAIL: ${failures.length} former hidden hrefs missing alias/LIVE:`)
  for (const f of failures) console.error(`  ${f}`)
  process.exit(1)
}

console.log(
  `OK: NAV_HIDDEN empty; soft-lock host unused; ${FORMER_HIDDEN.length} former hidden → alias (${aliasKeys.size}) or LIVE (${registered.size})`,
)
