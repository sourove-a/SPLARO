import { toastApiSaved, toastFail } from './feedback'
import { verifyDeleteSuccess } from './mutation-verify'
import {
  verifyCustomerBlockPersisted,
  verifyCustomerBlockResponse,
  verifyCustomerNotePersisted,
  verifyCustomerNoteResponse,
  verifyCustomerRemoved,
  verifyCustomerTagsPersisted,
  verifyCustomerTagsResponse,
} from './customer-mutation-verify'

export async function confirmCustomerBlockUpdated(
  id: string,
  blocked: boolean,
  save: () => Promise<unknown>,
): Promise<boolean> {
  try {
    const saved = await save()
    if (!verifyCustomerBlockResponse(saved, blocked)) return false
    if (!(await verifyCustomerBlockPersisted(id, blocked))) return false
    toastApiSaved(blocked ? 'Customer blocked.' : 'Customer unblocked.')
    return true
  } catch (err) {
    toastFail(err instanceof Error ? err.message : 'Could not update block status.')
    return false
  }
}

export async function confirmCustomerDeleted(
  id: string,
  force: boolean,
  save: () => Promise<unknown>,
): Promise<boolean> {
  try {
    const saved = await save()
    if (!verifyDeleteSuccess(saved)) return false
    if (!(await verifyCustomerRemoved(id))) return false
    toastApiSaved(force ? 'Customer and orders deleted permanently.' : 'Customer deleted permanently.')
    return true
  } catch (err) {
    toastFail(err instanceof Error ? err.message : 'Could not delete customer.')
    return false
  }
}

export async function confirmCustomerNoteAdded(
  id: string,
  content: string,
  save: () => Promise<unknown>,
): Promise<boolean> {
  const trimmed = content.trim()
  if (!trimmed) {
    toastFail('Note cannot be empty.')
    return false
  }
  try {
    const saved = await save()
    if (!verifyCustomerNoteResponse(saved, trimmed)) return false
    if (!(await verifyCustomerNotePersisted(id, trimmed))) return false
    toastApiSaved('Note saved.')
    return true
  } catch (err) {
    toastFail(err instanceof Error ? err.message : 'Could not save note.')
    return false
  }
}

export async function confirmCustomerTagsUpdated(
  id: string,
  tags: string[],
  label: string,
  save: () => Promise<unknown>,
): Promise<boolean> {
  try {
    const saved = await save()
    if (!verifyCustomerTagsResponse(saved, tags)) return false
    if (!(await verifyCustomerTagsPersisted(id, tags))) return false
    toastApiSaved(label)
    return true
  } catch (err) {
    toastFail(err instanceof Error ? err.message : 'Could not update tags.')
    return false
  }
}
