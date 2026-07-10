import type { PermissionAction } from '../../modules/security/security-permissions.util'

function normalizePath(path: string): string {
  return path.replace(/^\/api\/v1\//, '').replace(/^\//, '').split('?')[0] ?? ''
}

/** Any authenticated admin may link their own Telegram — not gated by admin-users matrix. */
function isStaffSelfTelegramPath(path: string): boolean {
  return (
    path === 'admin/security/staff/me/telegram' ||
    path === 'admin/security/staff/me/telegram-link-token'
  )
}

function methodToAction(method: string): PermissionAction {
  switch (method.toUpperCase()) {
    case 'POST':
      return 'create'
    case 'PUT':
    case 'PATCH':
      return 'edit'
    case 'DELETE':
      return 'delete'
    default:
      return 'view'
  }
}

type RouteRule = { test: (path: string) => boolean; module: string }

const ROUTE_RULES: RouteRule[] = [
  {
    test: (p) =>
      p.startsWith('admin/orders') ||
      p.startsWith('admin/fulfillment') ||
      p.startsWith('admin/shipping'),
    module: 'orders',
  },
  {
    test: (p) =>
      p.startsWith('admin/products') ||
      p.startsWith('admin/inventory') ||
      p.startsWith('admin/categories') ||
      p.startsWith('admin/collections') ||
      p.startsWith('admin/redirects') ||
      p.startsWith('commerce-os/wms') ||
      p.startsWith('commerce-os/production'),
    module: 'products',
  },
  {
    test: (p) =>
      p.startsWith('admin/finance') ||
      p.startsWith('admin/payments') ||
      p.startsWith('admin/coupons') ||
      p.startsWith('admin/affiliates') ||
      p.startsWith('commerce-os/procurement'),
    module: 'finance',
  },
  {
    test: (p) => p.startsWith('admin/security') || p.startsWith('admin/users'),
    module: 'admin-users',
  },
  {
    test: (p) =>
      p.startsWith('admin/settings') ||
      p.startsWith('admin/integrations') ||
      p.startsWith('admin/hub') ||
      p.startsWith('admin/platform') ||
      p.startsWith('admin/saas') ||
      p.startsWith('seo/audit'),
    module: 'settings',
  },
]

/** Map an authenticated admin route to a matrix module + action, or null to skip matrix check. */
export function resolveRoutePermission(
  path: string,
  method: string,
): { moduleSlug: string; action: PermissionAction } | null {
  const normalized = normalizePath(path)
  if (isStaffSelfTelegramPath(normalized)) {
    return null
  }
  if (
    !normalized.startsWith('admin/') &&
    !normalized.startsWith('commerce-os/') &&
    !normalized.startsWith('seo/audit')
  ) {
    return null
  }

  for (const rule of ROUTE_RULES) {
    if (rule.test(normalized)) {
      return { moduleSlug: rule.module, action: methodToAction(method) }
    }
  }

  if (normalized.startsWith('admin/') || normalized.startsWith('commerce-os/')) {
    return { moduleSlug: 'settings', action: methodToAction(method) }
  }

  return null
}
