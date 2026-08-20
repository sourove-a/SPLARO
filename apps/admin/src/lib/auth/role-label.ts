/** Primary owner account — shown as Owner in admin UI (design handoff). */
export const CEO_EMAIL = 'splaro.bd@gmail.com'

const ROLE_DISPLAY: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  STAFF: 'Editor',
  VIEWER: 'Viewer',
}

const OWNER_PLACEHOLDER_NAME = /^(splaro(\s+(ceo|admin))?)$/i

const PROFILE_EDIT_ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'STAFF'])

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

/** Sidebar / header display name — owner placeholder stays `splaro`; a saved name is shown. */
export function formatAdminDisplayName(name: string, email?: string | null): string {
  const trimmed = name.trim()
  if (isOwnerEmail(email) && (!trimmed || OWNER_PLACEHOLDER_NAME.test(trimmed))) return 'splaro'
  return trimmed || 'SPLARO admin'
}

export function canEditAdminProfile(role?: string | null): boolean {
  return PROFILE_EDIT_ROLES.has((role ?? '').toUpperCase())
}
