import { ApiError } from '@/lib/api/client'
import { fetchCustomer } from '@/lib/api/customers'
import {
  verifyBooleanEquals,
  verifyDeleteSuccess,
  verifyPersisted,
  verifyStringEquals,
} from './mutation-verify'
import { toastFail } from './feedback'

export function verifyCustomerBlockResponse(saved: unknown, blocked: boolean): boolean {
  if (!verifyDeleteSuccess(saved)) return false
  const got =
    saved && typeof saved === 'object' && 'blocked' in saved
      ? Boolean((saved as { blocked: unknown }).blocked)
      : undefined
  return verifyBooleanEquals(got, blocked, 'Customer block status')
}

export async function verifyCustomerBlockPersisted(id: string, blocked: boolean): Promise<boolean> {
  try {
    const customer = await fetchCustomer(id)
    return verifyBooleanEquals(customer.isBlocked ?? false, blocked, 'Customer block status')
  } catch {
    toastFail('Could not verify customer block status on server')
    return false
  }
}

/** Deleted customers must 404 on detail fetch — list pagination can miss rows. */
export async function verifyCustomerRemoved(id: string): Promise<boolean> {
  try {
    await fetchCustomer(id)
    return verifyPersisted(false, 'Customer delete did not persist on server')
  } catch (err) {
    if (err instanceof ApiError && err.isNotFound) {
      return true
    }
    toastFail('Could not verify customer delete on server')
    return false
  }
}

export function verifyCustomerNoteResponse(saved: unknown, content: string): boolean {
  if (!saved || typeof saved !== 'object') {
    return verifyPersisted(false, 'Customer note did not persist on server')
  }
  const body = 'body' in saved ? String((saved as { body: unknown }).body).trim() : ''
  const idOk = 'id' in saved && String((saved as { id: unknown }).id).trim().length > 0
  if (!verifyPersisted(idOk, 'Customer note did not persist on server')) return false
  return verifyStringEquals(body, content.trim(), 'Customer note')
}

export async function verifyCustomerNotePersisted(id: string, content: string): Promise<boolean> {
  try {
    const customer = await fetchCustomer(id)
    const expected = content.trim()
    const found = (customer.customerNotes ?? []).some((n) => n.body?.trim() === expected)
    return verifyPersisted(found, 'Customer note did not persist on server')
  } catch {
    toastFail('Could not verify customer note on server')
    return false
  }
}

function tagsMatch(got: string[], expected: string[]): boolean {
  const sortedGot = [...got].map((t) => t.trim()).filter(Boolean).sort()
  const sortedExpected = [...expected].map((t) => t.trim()).filter(Boolean).sort()
  return (
    sortedGot.length === sortedExpected.length &&
    sortedGot.every((t, i) => t === sortedExpected[i])
  )
}

export function verifyCustomerTagsResponse(saved: unknown, tags: string[]): boolean {
  if (!saved || typeof saved !== 'object') {
    return verifyPersisted(false, 'Customer tags did not persist on server')
  }
  const got =
    'tags' in saved && Array.isArray((saved as { tags: unknown }).tags)
      ? (saved as { tags: string[] }).tags
      : []
  return verifyPersisted(tagsMatch(got, tags), 'Customer tags did not persist on server')
}

export async function verifyCustomerTagsPersisted(id: string, tags: string[]): Promise<boolean> {
  try {
    const customer = await fetchCustomer(id)
    return verifyCustomerTagsResponse({ tags: customer.tags ?? [] }, tags)
  } catch {
    toastFail('Could not verify customer tags on server')
    return false
  }
}
