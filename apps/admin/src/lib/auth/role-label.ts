/** Primary owner account — shown as Owner in admin UI (design handoff). */
export const CEO_EMAIL = 'splaro.bd@gmail.com'

const ROLE_DISPLAY: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  STAFF: 'Editor',
  VIEWER: 'Viewer',
}

/** Roles the Owner can assign to other staff */
export const ASSIGNABLE_STAFF_ROLES = [
  { value: 'SUPER_ADMIN', label: 'Super Admin' },
  { value: 'ADMIN', label: 'Admin' },
  { value: 'MANAGER', label: 'Manager' },
  { value: 'STAFF', label: 'Editor' },
] as const

export function isOwnerEmail(email?: string | null): boolean {
  return email?.trim().toLowerCase() === CEO_EMAIL
}

export function formatAdminRoleLabel(role: string, email?: string | null): string {
  if (isOwnerEmail(email)) return 'Owner'
  return ROLE_DISPLAY[role] ?? role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

/** Sidebar / header display name — never “SPLARO CEO”; owner shows brand name `splaro`. */
export function formatAdminDisplayName(name: string, email?: string | null): string {
  if (isOwnerEmail(email)) return 'splaro'
  return name
}
