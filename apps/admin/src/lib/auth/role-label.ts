/** Primary owner account — shown as CEO in admin UI */
export const CEO_EMAIL = 'splaro.bd@gmail.com'

const ROLE_DISPLAY: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  STAFF: 'Editor',
  VIEWER: 'Viewer',
}

/** Roles the CEO can assign to other staff */
export const ASSIGNABLE_STAFF_ROLES = [
  { value: 'SUPER_ADMIN', label: 'Super Admin' },
  { value: 'ADMIN', label: 'Admin' },
  { value: 'MANAGER', label: 'Manager' },
  { value: 'STAFF', label: 'Editor' },
] as const

export function formatAdminRoleLabel(role: string, email?: string | null): string {
  if (email?.trim().toLowerCase() === CEO_EMAIL) return 'CEO'
  return ROLE_DISPLAY[role] ?? role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function formatAdminDisplayName(name: string, email?: string | null): string {
  if (email?.trim().toLowerCase() === CEO_EMAIL) return 'SPLARO CEO'
  return name
}
