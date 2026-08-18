import { hasPermission, type PermissionAction, type PermissionModule } from '@/lib/auth/permissions'
import { normalizeAdminHref } from '@/lib/navigation/admin-nav'

type RouteRule = { test: (path: string) => boolean; module: PermissionModule }
type AdminRoleKey = 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'STAFF'

/** Maps admin nav hrefs → RBAC module (mirrors apps/api admin-route-permissions.util.ts). */
const NAV_MODULE_RULES: RouteRule[] = [
  {
    test: (p) =>
      p.includes('/orders') ||
      p.includes('/packing-station') ||
      p.includes('/returns-rma') ||
      p.includes('/invoices') ||
      p.includes('/transactions') ||
      p.includes('/pos') ||
      p.includes('/subscriptions') ||
      p.includes('/courier-hub') ||
      p.includes('/shipping') ||
      p.includes('/delivery/'),
    module: 'orders',
  },
  {
    test: (p) =>
      p.includes('/products') ||
      p.includes('/product-reviews') ||
      p.includes('/collections') ||
      p.includes('/categories') ||
      p.includes('/inventory') ||
      p.includes('/brands') ||
      p.includes('/attributes') ||
      p.includes('/sku-manager') ||
      p.includes('/qr-manager') ||
      p.includes('/barcode-manager') ||
      p.includes('/wms/') ||
      p.includes('/procurement/') ||
      p.includes('/production/') ||
      p.includes('/redirect-manager'),
    module: 'products',
  },
  {
    test: (p) =>
      p.includes('/finance/') ||
      p.includes('/coupons') ||
      p.includes('/campaigns') ||
      p.includes('/email-sms'),
    module: 'finance',
  },
  {
    test: (p) =>
      p.includes('/security-center') ||
      p.includes('/admin-users') ||
      p.includes('/roles') ||
      p.includes('/permissions') ||
      p.includes('/audit-logs'),
    module: 'admin-users',
  },
]

const ROLE_DENIED_HREF_PREFIXES: Record<Exclude<AdminRoleKey, 'SUPER_ADMIN'>, string[]> = {
  ADMIN: [
    '/dashboard/company/',
    '/dashboard/developer/',
    '/dashboard/observability/',
    '/dashboard/google-workspace/oauth-settings',
  ],
  MANAGER: [
    '/dashboard/security-center',
    '/dashboard/admin-users',
    '/dashboard/settings',
    '/dashboard/logs',
    '/dashboard/google-workspace/',
    '/dashboard/company/',
    '/dashboard/developer/',
    '/dashboard/observability/',
  ],
  STAFF: [
    '/dashboard/analytics',
    '/dashboard/executive/',
    '/dashboard/subscriptions',
    '/dashboard/wholesale-',
    '/dashboard/campaigns',
    '/dashboard/coupons',
    '/dashboard/finance/',
    '/dashboard/all-integrations',
    '/dashboard/sms',
    '/dashboard/automation/google-sheets-sync',
    '/dashboard/telegram-bot',
    '/dashboard/api-health',
    '/dashboard/webhooks',
    '/dashboard/seo-health',
    '/dashboard/ai-agent',
    '/dashboard/automation-rules',
    '/dashboard/operations',
    '/dashboard/packing-station',
    '/dashboard/courier-hub',
    '/dashboard/wms/',
    '/dashboard/procurement/',
    '/dashboard/production/',
    '/dashboard/support/',
    '/dashboard/delivery/',
    '/dashboard/company/',
    '/dashboard/developer/',
    '/dashboard/observability/',
    '/dashboard/google-workspace/',
    '/dashboard/security-center',
    '/dashboard/admin-users',
    '/dashboard/settings',
    '/dashboard/logs',
  ],
}

function normalizeRole(role: string | undefined): AdminRoleKey {
  const key = (role ?? 'STAFF').toUpperCase().replace(/ /g, '_')
  if (key === 'SUPER_ADMIN' || key === 'ADMIN' || key === 'MANAGER') return key
  return 'STAFF'
}

export function canRoleAccessAdminHref(href: string, role: string | undefined): boolean {
  const roleKey = normalizeRole(role)
  if (roleKey === 'SUPER_ADMIN') return true
  const normalized = normalizeAdminHref(href)
  return !ROLE_DENIED_HREF_PREFIXES[roleKey].some((prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`) || normalized.startsWith(prefix))
}

export function resolveNavPermissionModule(href: string): PermissionModule {
  const path = normalizeAdminHref(href).split('?')[0] ?? '/dashboard'
  for (const rule of NAV_MODULE_RULES) {
    if (rule.test(path)) return rule.module
  }
  return 'settings'
}

export interface AdminNavSession {
  role?: string
  permissions?: string[]
}

export function canAccessNavRoute(
  href: string,
  session: AdminNavSession | null | undefined,
  action: PermissionAction = 'view',
): boolean {
  if (!session?.role) return false
  if (!canRoleAccessAdminHref(href, session.role)) return false
  const permModule = resolveNavPermissionModule(href)
  if (normalizeAdminHref(href) === '/dashboard' && action === 'view') {
    return (
      hasPermission(session.role, session.permissions, 'settings', 'view') ||
      hasPermission(session.role, session.permissions, 'orders', 'view') ||
      hasPermission(session.role, session.permissions, 'products', 'view') ||
      hasPermission(session.role, session.permissions, 'finance', 'view') ||
      hasPermission(session.role, session.permissions, 'admin-users', 'view')
    )
  }
  return hasPermission(session.role, session.permissions, permModule, action)
}
