import { fetchSecurity } from '@/lib/api/platform'
import {
  fetchRolePermissions,
  fetchSecuritySessions,
  fetchStaffList,
  type PermissionRow,
} from '@/lib/api/security'
import { verifyBooleanEquals, verifyPersisted, verifyStringEquals } from './mutation-verify'
import { deepEqual } from './settings-save'
import { toastFail } from './feedback'

export function verifyStaffMutationFlag(saved: unknown, key: string, label: string): boolean {
  const ok = Boolean(
    saved &&
      typeof saved === 'object' &&
      key in saved &&
      (saved as Record<string, unknown>)[key] === true,
  )
  return verifyPersisted(ok, `${label} did not persist on server`)
}

export function verifyInviteResponse(
  saved: unknown,
  expected: { email: string; role: string },
): boolean {
  if (!saved || typeof saved !== 'object') {
    return verifyPersisted(false, 'Admin invite did not persist on server')
  }
  const row = saved as { id?: string; email?: string; role?: string }
  if (!verifyStringEquals(row.email, expected.email, 'Admin email')) return false
  if (!verifyStringEquals(String(row.role ?? '').toUpperCase(), expected.role.toUpperCase(), 'Admin role')) {
    return false
  }
  return verifyPersisted(Boolean(row.id), 'Admin invite did not persist on server')
}

export async function verifyStaffPersisted(
  userId: string,
  expected: { role?: string; isActive?: boolean; telegramLinked?: boolean },
): Promise<boolean> {
  try {
    const staff = await fetchStaffList()
    const row = staff.find((s) => s.user.id === userId)
    if (!row) {
      return verifyPersisted(expected.isActive === false, 'Staff member did not persist on server')
    }
    if (expected.role !== undefined && !verifyStringEquals(row.role.toUpperCase(), expected.role.toUpperCase(), 'Staff role')) {
      return false
    }
    if (expected.isActive !== undefined && !verifyBooleanEquals(row.user.isActive, expected.isActive, 'Staff status')) {
      return false
    }
    if (expected.telegramLinked !== undefined) {
      const security = await fetchSecurity()
      const overview = security.adminUsers.find((u) => u.id === userId)
      if (!overview) return verifyPersisted(false, 'Staff Telegram state did not persist on server')
      return verifyBooleanEquals(overview.telegramLinked, expected.telegramLinked, 'Telegram link')
    }
    return true
  } catch {
    toastFail('Could not verify staff on server')
    return false
  }
}

export async function verifyStaffRemoved(userId: string): Promise<boolean> {
  try {
    const staff = await fetchStaffList()
    const row = staff.find((s) => s.user.id === userId)
    return verifyPersisted(!row, 'Staff removal did not persist on server')
  } catch {
    toastFail('Could not verify staff removal on server')
    return false
  }
}

export async function verifyRolePermissionsPersisted(
  role: string,
  expected: PermissionRow[],
): Promise<boolean> {
  try {
    const data = await fetchRolePermissions()
    const row = data.roles.find((r) => r.role === role)
    if (!row?.permissions?.length) {
      return verifyPersisted(false, 'Role permissions did not persist on server')
    }
    return verifyPersisted(deepEqual(row.permissions, expected), 'Role permissions did not persist on server')
  } catch {
    toastFail('Could not verify role permissions on server')
    return false
  }
}

export async function verifySessionRevoked(sessionId: string): Promise<boolean> {
  try {
    const sessions = await fetchSecuritySessions()
    const row = sessions.find((s) => s.id === sessionId)
    return verifyPersisted(!row, 'Session revoke did not persist on server')
  } catch {
    toastFail('Could not verify session revoke on server')
    return false
  }
}
