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

export function fetchStaffList() {
  return apiFetch<
    Array<{
      userId: string
      role: string
      user: { id: string; email: string | null; isActive: boolean }
    }>
  >('/admin/security/staff')
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

export function fetchStaffTelegramLinkToken() {
  return apiFetch<{
    ok: boolean
    code: string
    email: string
    expiresInSeconds: number
    hint: string
  }>('/admin/security/staff/me/telegram-link-token', { method: 'POST' })
}

export function fetchMyTelegramStatus() {
  return apiFetch<{ telegramLinked: boolean; telegramUsername: string | null }>(
    '/admin/security/staff/me/telegram',
  )
}

export function resetStaffTelegram(userId: string) {
  return apiFetch<{ ok: boolean; reset: boolean }>(`/admin/security/staff/${userId}/telegram`, {
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

// ─── Database connection (SUPER_ADMIN only) ──────────────────────────────────

export interface DatabaseConnectionInfo {
  host: string
  port: string
  database: string
  user: string
  passwordSet: boolean
  connected: boolean
  source: 'environment' | 'database'
  savedInDatabase: boolean
  requiresRestart: boolean
}

export interface DatabaseCredentialsInput {
  url?: string
  host?: string
  port?: string
  database?: string
  user?: string
  password?: string
}

export function fetchDatabaseConnection() {
  return apiFetch<DatabaseConnectionInfo>('/admin/security/database')
}

export function testDatabaseConnection(input: DatabaseCredentialsInput) {
  return apiFetch<{ ok: boolean; message: string }>('/admin/security/database/test', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function saveDatabaseConnection(input: DatabaseCredentialsInput) {
  return apiFetch<{ ok: boolean; message: string; savedToDatabase?: boolean }>('/admin/security/database', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}
