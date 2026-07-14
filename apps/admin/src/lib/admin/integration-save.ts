import {
  fetchTelegramIntegration,
  fetchTelegramLinkedAdmins,
  type TelegramIntegration,
} from '@/lib/api/integrations'
import { toastApiSaved, toastFail, toastOk } from './feedback'
import { verifyBooleanEquals, verifyPersisted, verifyStringEquals } from './mutation-verify'

export type IntegrationSaveResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: string }

/**
 * Save integration credentials → refetch → assert server state before green toast.
 */
export async function saveIntegrationAndVerify<T>({
  save,
  refetch,
  assert,
}: {
  save: () => Promise<T>
  refetch: () => Promise<{ data?: T }>
  assert: (data: T) => string | null
}): Promise<IntegrationSaveResult<T>> {
  try {
    await save()
    const fresh = await refetch()
    if (!fresh.data) {
      return { ok: false, reason: 'Save succeeded but refetch returned no data' }
    }
    const reason = assert(fresh.data)
    if (reason) return { ok: false, reason }
    return { ok: true, data: fresh.data }
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : 'Save failed' }
  }
}

export type TelegramSettingsExpected = {
  chatId: string
  isEnabled: boolean
  notifyOrders: boolean
  notifyCustomers: boolean
  notifyPayments: boolean
  notifyCourier: boolean
  notifyStock: boolean
  notifyReviews: boolean
  reportDaily: boolean
  reportTime: string
  /** When true, server must report tokenConfigured after save. */
  requireTokenConfigured?: boolean
}

export function verifyTelegramSettingsMatch(
  data: TelegramIntegration,
  expected: TelegramSettingsExpected,
): boolean {
  if (!verifyStringEquals(data.chatId?.trim() ?? '', expected.chatId.trim(), 'Telegram chat ID')) {
    return false
  }
  if (!verifyBooleanEquals(data.isEnabled, expected.isEnabled, 'Telegram enabled')) return false
  if (!verifyBooleanEquals(data.notifyOrders, expected.notifyOrders, 'Notify orders')) return false
  if (!verifyBooleanEquals(data.notifyCustomers, expected.notifyCustomers, 'Notify customers')) {
    return false
  }
  if (!verifyBooleanEquals(data.notifyPayments, expected.notifyPayments, 'Notify payments')) {
    return false
  }
  if (!verifyBooleanEquals(data.notifyCourier, expected.notifyCourier, 'Notify courier')) return false
  if (!verifyBooleanEquals(data.notifyStock, expected.notifyStock, 'Notify stock')) return false
  if (!verifyBooleanEquals(data.notifyReviews, expected.notifyReviews, 'Notify reviews')) return false
  if (!verifyBooleanEquals(data.reportDaily, expected.reportDaily, 'Daily report')) return false
  if (!verifyStringEquals(data.reportTime ?? '', expected.reportTime, 'Report time')) return false
  if (expected.requireTokenConfigured) {
    return verifyPersisted(Boolean(data.tokenConfigured), 'Telegram bot token did not persist on server')
  }
  return true
}

export async function confirmTelegramSettingsSaved(
  expected: TelegramSettingsExpected,
  save: () => Promise<TelegramIntegration>,
): Promise<boolean> {
  try {
    const saved = await save()
    if (!verifyTelegramSettingsMatch(saved, expected)) return false
    const fresh = await fetchTelegramIntegration()
    if (!verifyTelegramSettingsMatch(fresh, expected)) return false
    toastApiSaved('Telegram settings')
    return true
  } catch (err) {
    toastFail(err instanceof Error ? err.message : 'Could not save Telegram settings.')
    return false
  }
}

export function verifyTelegramTestResponse(saved: unknown): boolean {
  if (!saved || typeof saved !== 'object') {
    return verifyPersisted(false, 'Telegram test did not reach server')
  }
  return verifyBooleanEquals((saved as { ok?: boolean }).ok, true, 'Telegram test')
}

export async function confirmTelegramTestSent(save: () => Promise<unknown>): Promise<boolean> {
  try {
    const saved = await save()
    if (!verifyTelegramTestResponse(saved)) return false
    const message =
      saved && typeof saved === 'object' && 'message' in saved
        ? String((saved as { message: string }).message)
        : 'Test message sent to Telegram.'
    toastOk(message)
    return true
  } catch (err) {
    toastFail(err instanceof Error ? err.message : 'Telegram test failed')
    return false
  }
}

export function verifyTelegramUnlinkResponse(saved: unknown): boolean {
  if (!saved || typeof saved !== 'object') {
    return verifyPersisted(false, 'Telegram unlink did not persist on server')
  }
  return verifyBooleanEquals((saved as { ok?: boolean }).ok, true, 'Telegram unlink')
}

export async function verifyTelegramAdminUnlinked(id: string): Promise<boolean> {
  try {
    const data = await fetchTelegramLinkedAdmins()
    const stillLinked = data.linked.some((a) => a.id === id)
    return verifyPersisted(!stillLinked, 'Telegram unlink did not persist on server')
  } catch {
    toastFail('Could not verify Telegram unlink on server')
    return false
  }
}

export async function confirmTelegramAdminUnlinked(
  id: string,
  save: () => Promise<unknown>,
): Promise<boolean> {
  try {
    const saved = await save()
    if (!verifyTelegramUnlinkResponse(saved)) return false
    if (!(await verifyTelegramAdminUnlinked(id))) return false
    toastApiSaved('Telegram admin unlinked')
    return true
  } catch (err) {
    toastFail(err instanceof Error ? err.message : 'Unlink failed')
    return false
  }
}
