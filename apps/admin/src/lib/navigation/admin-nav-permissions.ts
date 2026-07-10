import { hasPermission, type PermissionAction, type PermissionModule } from '@/lib/auth/permissions'
import { normalizeAdminHref } from '@/lib/navigation/admin-nav'

type RouteRule = { test: (path: string) => boolean; module: PermissionModule }

/** Maps admin nav hrefs → RBAC module (mirrors apps/api admin-route-permissions.util.ts). */
const NAV_MODULE_RULES: RouteRule[] = [
  {
    test: (p) =>
      p.includes('/orders') ||
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
    test: (p) => p.includes('/finance/'),
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
