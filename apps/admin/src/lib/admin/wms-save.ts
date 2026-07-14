import { toastApiSaved, toastFail } from './feedback'
import {
  verifyStockMovementPersisted,
  verifyStockMovementResponse,
  verifyStockTransferPersisted,
  verifyStockTransferResponse,
  verifyWarehousePersisted,
  verifyWarehouseResponse,
} from './wms-mutation-verify'

export async function confirmWarehouseCreated(
  expected: { name: string; code: string; city?: string },
  save: () => Promise<unknown>,
): Promise<string | null> {
  try {
    const saved = await save()
    if (!verifyWarehouseResponse(saved, expected)) return null
    const id = saved && typeof saved === 'object' && 'id' in saved ? String((saved as { id: string }).id) : ''
    if (!id || !(await verifyWarehousePersisted(id, expected))) return null
    toastApiSaved('Warehouse created')
    return id
  } catch (err) {
    toastFail(err instanceof Error ? err.message : 'Could not create warehouse.')
    return null
  }
}

export async function confirmStockMovementRecorded(
  expected: { sku: string; delta: number },
  save: () => Promise<unknown>,
): Promise<boolean> {
  try {
    const saved = await save()
    if (!verifyStockMovementResponse(saved, expected)) return false
    const movement =
      saved && typeof saved === 'object' && 'movement' in saved
        ? (saved as { movement: { id: string } }).movement
        : (saved as { id: string })
    const id = movement?.id ? String(movement.id) : ''
    if (!id || !(await verifyStockMovementPersisted(id, expected))) return false
    toastApiSaved('Stock movement recorded')
    return true
  } catch (err) {
    toastFail(err instanceof Error ? err.message : 'Could not record movement.')
    return false
  }
}

export async function confirmStockTransferCreated(
  save: () => Promise<unknown>,
): Promise<string | null> {
  try {
    const saved = await save()
    if (!verifyStockTransferResponse(saved, { status: 'PENDING' })) return null
    const transfer =
      saved && typeof saved === 'object' && 'transfer' in saved
        ? (saved as { transfer: { id: string } }).transfer
        : (saved as { id: string })
    const id = transfer?.id ? String(transfer.id) : ''
    if (!id || !(await verifyStockTransferPersisted(id, { status: 'PENDING' }))) return null
    toastApiSaved('Transfer created')
    return id
  } catch (err) {
    toastFail(err instanceof Error ? err.message : 'Could not create transfer.')
    return null
  }
}

export async function confirmStockTransferShipped(
  transferId: string,
  save: () => Promise<unknown>,
): Promise<boolean> {
  try {
    const saved = await save()
    if (!verifyStockTransferResponse(saved, { status: 'IN_TRANSIT' })) return false
    if (!(await verifyStockTransferPersisted(transferId, { status: 'IN_TRANSIT' }))) return false
    toastApiSaved('Transfer marked in transit')
    return true
  } catch (err) {
    toastFail(err instanceof Error ? err.message : 'Could not ship transfer.')
    return false
  }
}

export async function confirmStockTransferReceived(
  transferId: string,
  save: () => Promise<unknown>,
): Promise<boolean> {
  try {
    const saved = await save()
    if (!verifyStockTransferResponse(saved, { status: 'COMPLETED' })) return false
    if (!(await verifyStockTransferPersisted(transferId, { status: 'COMPLETED' }))) return false
    toastApiSaved('Transfer received and completed')
    return true
  } catch (err) {
    toastFail(err instanceof Error ? err.message : 'Could not receive transfer.')
    return false
  }
}
