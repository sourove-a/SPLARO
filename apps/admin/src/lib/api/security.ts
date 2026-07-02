import { apiFetch } from './client'

export interface PermissionRow {
  module: string
  view: boolean
  create: boolean
  edit: boolean
  delete: boolean
}

export interface InviteAdminInput {
  email: string
  firstName: string
  lastName?: string
  role: string
  password: string
}

export interface InviteAdminResponse {
  id: string
  email: string
  name: string
  role: string
  status: string
}

export interface RolePermissionsResponse {
  roles: Array<{
    role: string
    label: string
    permissions: PermissionRow[]
  }>
}

export function fetchRolePermissions() {
  return apiFetch<RolePermissionsResponse>('/admin/security/permissions')
}

export function saveRolePermissions(role: string, permissions: PermissionRow[]) {
  return apiFetch<{ saved: boolean; role: string; permissions: PermissionRow[] }>(
    `/admin/security/permissions/${encodeURIComponent(role)}`,
    {
      method: 'PUT',
      body: JSON.stringify({ permissions }),
    },
  )
}

export function inviteAdmin(data: InviteAdminInput) {
  return apiFetch<InviteAdminResponse>('/admin/security/staff/invite', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function updateStaffRole(
  userId: string,
  data: { role?: string; permissions?: string[]; isActive?: boolean },
) {
  return apiFetch<{ updated: boolean }>(`/admin/security/staff/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export function removeStaff(userId: string) {
  return apiFetch<{ removed: boolean }>(`/admin/security/staff/${userId}`, {
    method: 'DELETE',
  })
}

export interface SecuritySessionRow {
  id: string
  browser: string | null
  os: string | null
  deviceName: string | null
  ipAddress: string | null
  lastActive: string
  expiresAt: string
  user: { firstName: string; lastName: string; email: string | null }
}

export function fetchSecuritySessions() {
  return apiFetch<SecuritySessionRow[]>('/admin/security/sessions')
}

export function revokeSecuritySession(sessionId: string) {
  return apiFetch<{ revoked: boolean }>(`/admin/security/sessions/${sessionId}`, {
    method: 'DELETE',
  })
}
