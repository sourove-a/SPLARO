/**
 * Client-side mirror of apps/api's security-permissions.util.ts staffHasPermission().
 * The API is the real enforcement boundary (AdminAuthGuard blocks every request) —
 * this is UX-only: hides/disables actions a role can't perform instead of letting
 * the user click through to a 403.
 *
 * Keep DEFAULT_ROLE_PERMISSIONS in sync with apps/api/src/modules/security/security-permissions.util.ts
 */

export type PermissionAction = 'view' | 'create' | 'edit' | 'delete'
export type PermissionModule = 'orders' | 'products' | 'finance' | 'admin-users' | 'settings'

export const PERMISSION_DENIED_TITLE = 'Your role does not have permission for this action'

interface PermissionRow {
  module: string
  view: boolean
  create: boolean
  edit: boolean
  delete: boolean
}

const PERMISSION_MODULES = ['Orders', 'Products', 'Finance', 'Admin Users', 'Settings'] as const

const MODULE_SLUG: Record<string, PermissionModule> = {
  Orders: 'orders',
  Products: 'products',
  Finance: 'finance',
  'Admin Users': 'admin-users',
  Settings: 'settings',
}

const ROLE_UI_TO_API: Record<string, string> = {
  'Super Admin': 'SUPER_ADMIN',
  Admin: 'ADMIN',
  Manager: 'MANAGER',
  Editor: 'STAFF',
}

function defaultRow(module: string, overrides?: Partial<PermissionRow>): PermissionRow {
  return {
    module,
    view: true,
    create: false,
    edit: false,
    delete: false,
    ...overrides,
  }
}

const DEFAULT_ROLE_PERMISSIONS: Record<string, PermissionRow[]> = {
  SUPER_ADMIN: PERMISSION_MODULES.map((m) =>
    defaultRow(m, { view: true, create: true, edit: true, delete: m !== 'Admin Users' }),
  ),
  ADMIN: [
    defaultRow('Orders', { view: true, create: true, edit: true }),
    defaultRow('Products', { view: true, create: true, edit: true, delete: true }),
    defaultRow('Finance', { view: true }),
    defaultRow('Admin Users', { view: true }),
    defaultRow('Settings', { view: true, create: true, edit: true }),
  ],
  MANAGER: [
    defaultRow('Orders', { view: true, create: true, edit: true }),
    defaultRow('Products', { view: true, edit: true }),
    defaultRow('Finance', { view: true }),
    defaultRow('Admin Users', { view: false }),
    defaultRow('Settings', { view: true }),
  ],
  STAFF: [
    defaultRow('Orders', { view: true }),
    defaultRow('Products', { view: true, edit: true }),
    defaultRow('Finance', { view: false }),
    defaultRow('Admin Users', { view: false }),
    defaultRow('Settings', { view: true }),
  ],
}

function encodePermissionTokens(rows: PermissionRow[]): string[] {
  const tokens: string[] = []
  for (const row of rows) {
    const slug = MODULE_SLUG[row.module] ?? (row.module.toLowerCase().replace(/\s+/g, '-') as PermissionModule)
    if (row.view) tokens.push(`${slug}:view`)
    if (row.create) tokens.push(`${slug}:create`)
    if (row.edit) tokens.push(`${slug}:edit`)
    if (row.delete) tokens.push(`${slug}:delete`)
  }
  return tokens
}

function normalizeRoleKey(role: string | undefined): string {
  if (!role) return 'STAFF'
  return ROLE_UI_TO_API[role] ?? role.toUpperCase().replace(/ /g, '_')
}

function resolvePermissionTokens(role: string | undefined, permissions: string[] | undefined): string[] {
  const roleKey = normalizeRoleKey(role)
  if (roleKey === 'SUPER_ADMIN') return ['*']
  if (permissions?.length) return permissions
  return encodePermissionTokens(DEFAULT_ROLE_PERMISSIONS[roleKey] ?? DEFAULT_ROLE_PERMISSIONS.STAFF ?? [])
}

export function hasPermission(
  role: string | undefined,
  permissions: string[] | undefined,
  moduleSlug: PermissionModule,
  action: PermissionAction,
): boolean {
  const roleKey = normalizeRoleKey(role)
  if (roleKey === 'SUPER_ADMIN') return true

  const tokens = resolvePermissionTokens(role, permissions)
  if (tokens.includes('*')) return true
  return tokens.includes(`${moduleSlug}:${action}`)
}
