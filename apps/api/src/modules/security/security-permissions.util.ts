export interface PermissionRow {
  module: string
  view: boolean
  create: boolean
  edit: boolean
  delete: boolean
}

export const PERMISSION_MODULES = ['Orders', 'Products', 'Finance', 'Admin Users', 'Settings'] as const

const MODULE_SLUG: Record<string, string> = {
  Orders: 'orders',
  Products: 'products',
  Finance: 'finance',
  'Admin Users': 'admin-users',
  Settings: 'settings',
}

const SLUG_MODULE = Object.fromEntries(
  Object.entries(MODULE_SLUG).map(([label, slug]) => [slug, label]),
) as Record<string, string>

export const ROLE_UI_TO_API: Record<string, string> = {
  'Super Admin': 'SUPER_ADMIN',
  Admin: 'ADMIN',
  Manager: 'MANAGER',
  Editor: 'STAFF',
}

export const ROLE_API_TO_UI: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  STAFF: 'Editor',
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

export const DEFAULT_ROLE_PERMISSIONS: Record<string, PermissionRow[]> = {
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

export function encodePermissionTokens(rows: PermissionRow[]): string[] {
  const tokens: string[] = []
  for (const row of rows) {
    const slug = MODULE_SLUG[row.module] ?? row.module.toLowerCase().replace(/\s+/g, '-')
    if (row.view) tokens.push(`${slug}:view`)
    if (row.create) tokens.push(`${slug}:create`)
    if (row.edit) tokens.push(`${slug}:edit`)
    if (row.delete) tokens.push(`${slug}:delete`)
  }
  return tokens
}

export function decodePermissionTokens(tokens: string[]): PermissionRow[] {
  const map = new Map<string, PermissionRow>()
  for (const module of PERMISSION_MODULES) {
    map.set(module, defaultRow(module, { view: false, create: false, edit: false, delete: false }))
  }

  for (const token of tokens) {
    if (token === '*') {
      return DEFAULT_ROLE_PERMISSIONS.SUPER_ADMIN ?? []
    }
    const [slug, action] = token.split(':')
    if (!slug || !action) continue
    const module = SLUG_MODULE[slug] ?? slug
    const row = map.get(module) ?? defaultRow(module)
    if (action === 'view') row.view = true
    if (action === 'create') row.create = true
    if (action === 'edit') row.edit = true
    if (action === 'delete') row.delete = true
    map.set(module, row)
  }

  return PERMISSION_MODULES.map((m) => map.get(m) ?? defaultRow(m))
}

export function normalizeRoleKey(role: string): string {
  return ROLE_UI_TO_API[role] ?? role.toUpperCase().replace(/ /g, '_')
}

export type PermissionAction = 'view' | 'create' | 'edit' | 'delete'

export function staffHasPermission(
  role: string,
  permissionTokens: string[] | undefined,
  moduleSlug: string,
  action: PermissionAction,
): boolean {
  const roleKey = normalizeRoleKey(role)
  if (roleKey === 'SUPER_ADMIN') return true

  const tokens =
    permissionTokens?.length
      ? permissionTokens
      : encodePermissionTokens(
          DEFAULT_ROLE_PERMISSIONS[roleKey] ?? DEFAULT_ROLE_PERMISSIONS.STAFF ?? [],
        )

  if (tokens.includes('*')) return true

  const moduleLabel = SLUG_MODULE[moduleSlug]
  if (!moduleLabel) return false

  const rows = decodePermissionTokens(tokens)
  const row = rows.find((r) => r.module === moduleLabel)
  if (!row) return false
  return Boolean(row[action])
}
