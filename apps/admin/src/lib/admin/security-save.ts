import { toastApiSaved, toastFail, toastOk } from './feedback'
import type { PermissionRow } from '@/lib/api/security'
import {
  verifyInviteResponse,
  verifyRolePermissionsPersisted,
  verifySessionRevoked,
  verifyStaffMutationFlag,
  verifyStaffPersisted,
  verifyStaffRemoved,
} from './security-mutation-verify'
import { verifyPersisted } from './mutation-verify'

export async function confirmAdminInvited(
  expected: { email: string; role: string },
  save: () => Promise<unknown>,
): Promise<boolean> {
  try {
    const saved = await save()
    if (!verifyInviteResponse(saved, expected)) return false
    const id = saved && typeof saved === 'object' && 'id' in saved ? String((saved as { id: string }).id) : ''
    if (!id || !(await verifyStaffPersisted(id, { role: expected.role, isActive: true }))) return false
    toastApiSaved(`Admin ${expected.email} invited`)
    return true
  } catch (err) {
    toastFail(err instanceof Error ? err.message : 'Could not invite admin.')
    return false
  }
}

export async function confirmStaffRoleUpdated(
  userId: string,
  role: string,
  save: () => Promise<unknown>,
): Promise<boolean> {
  try {
    const saved = await save()
    if (!verifyStaffMutationFlag(saved, 'updated', 'Role update')) return false
    if (!(await verifyStaffPersisted(userId, { role }))) return false
    toastApiSaved('Role updated')
    return true
  } catch (err) {
    toastFail(err instanceof Error ? err.message : 'Could not update role.')
    return false
  }
}

export async function confirmStaffActiveUpdated(
  userId: string,
  isActive: boolean,
  save: () => Promise<unknown>,
): Promise<boolean> {
  try {
    const saved = await save()
    if (!verifyStaffMutationFlag(saved, 'updated', 'Staff status update')) return false
    if (!(await verifyStaffPersisted(userId, { isActive }))) return false
    toastApiSaved(isActive ? 'Admin reactivated' : 'Admin deactivated')
    return true
  } catch (err) {
    toastFail(err instanceof Error ? err.message : 'Could not update admin status.')
    return false
  }
}

export async function confirmStaffRemoved(
  userId: string,
  email: string,
  save: () => Promise<unknown>,
): Promise<boolean> {
  try {
    const saved = await save()
    if (!verifyStaffMutationFlag(saved, 'removed', 'Staff removal')) return false
    if (!(await verifyStaffRemoved(userId))) return false
    toastApiSaved(`Removed ${email}`)
    return true
  } catch (err) {
    toastFail(err instanceof Error ? err.message : 'Could not remove admin.')
    return false
  }
}

export async function confirmTelegramReset(
  userId: string,
  name: string,
  save: () => Promise<unknown>,
): Promise<boolean> {
  try {
    const saved = await save()
    if (!verifyStaffMutationFlag(saved, 'reset', 'Telegram reset')) return false
    if (!(await verifyStaffPersisted(userId, { telegramLinked: false }))) return false
    toastApiSaved(`Telegram reset for ${name}`)
    return true
  } catch (err) {
    toastFail(err instanceof Error ? err.message : 'Could not reset Telegram.')
    return false
  }
}

export async function confirmRolePermissionsSaved(
  role: string,
  permissions: PermissionRow[],
  label: string,
  save: () => Promise<unknown>,
): Promise<boolean> {
  try {
    const saved = await save()
    if (!verifyStaffMutationFlag(saved, 'saved', 'Permissions save')) return false
    if (!(await verifyRolePermissionsPersisted(role, permissions))) return false
    toastApiSaved(`${label} permissions saved to server`)
    return true
  } catch (err) {
    toastFail(err instanceof Error ? err.message : 'Could not save permissions.')
    return false
  }
}

export async function confirmSessionRevoked(
  sessionId: string,
  save: () => Promise<unknown>,
): Promise<boolean> {
  try {
    const saved = await save()
    if (!verifyStaffMutationFlag(saved, 'revoked', 'Session revoke')) return false
    if (!(await verifySessionRevoked(sessionId))) return false
    toastApiSaved('Session revoked')
    return true
  } catch (err) {
    toastFail(err instanceof Error ? err.message : 'Could not revoke session.')
    return false
  }
}

export type TelegramLinkTokenResult = {
  ok: boolean
  code: string
  expiresInSeconds: number
  hint: string
  email?: string
}

export function confirmTelegramLinkToken(saved: unknown): boolean {
  const ok = Boolean(
    saved &&
      typeof saved === 'object' &&
      'ok' in saved &&
      (saved as { ok: unknown }).ok === true &&
      'code' in saved &&
      String((saved as { code: unknown }).code).trim().length > 0 &&
      'expiresInSeconds' in saved &&
      Number((saved as { expiresInSeconds: unknown }).expiresInSeconds) > 0,
  )
  return verifyPersisted(ok, 'Telegram link code did not generate on server')
}

/** Generate + verify link token, then toast the one-time code (not a DB "saved" mutation). */
export async function confirmTelegramLinkTokenGenerated(
  save: () => Promise<unknown>,
  toastId = 'tg-staff-link',
): Promise<TelegramLinkTokenResult | null> {
  try {
    const saved = await save()
    if (!confirmTelegramLinkToken(saved)) return null
    const res = saved as TelegramLinkTokenResult
    const minutes = Math.max(1, Math.round(Number(res.expiresInSeconds) / 60))
    const hint = String(res.hint || 'Send /login with this code in Telegram').trim()
    toastOk(`${hint} — Code: ${res.code} (expires in ${minutes} min)`, toastId)
    return res
  } catch (err) {
    toastFail(err instanceof Error ? err.message : 'Could not create link code.')
    return null
  }
}
