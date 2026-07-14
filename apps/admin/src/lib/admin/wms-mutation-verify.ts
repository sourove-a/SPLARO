import {
  fetchWmsOverview,
  type WmsMovement,
  type WmsTransfer,
  type WmsWarehouse,
} from '@/lib/api/commerce-os'
import {
  verifyNumberEquals,
  verifyPersisted,
  verifyStringEquals,
} from './mutation-verify'
import { toastFail } from './feedback'

function hasId(saved: unknown): saved is { id: string } {
  return Boolean(saved && typeof saved === 'object' && 'id' in saved && String((saved as { id: unknown }).id).trim())
}

export function verifyWarehouseResponse(
  saved: unknown,
  expected: { name: string; code: string; city?: string },
): boolean {
  if (!hasId(saved)) return verifyPersisted(false, 'Warehouse did not persist on server')
  const row = saved as WmsWarehouse
  if (!verifyStringEquals(row.name, expected.name, 'Warehouse name')) return false
  const code = expected.code.trim().toUpperCase()
  if (!verifyStringEquals(row.code, code, 'Warehouse code')) return false
  if (expected.city !== undefined && !verifyStringEquals(row.city ?? '', expected.city, 'Warehouse city')) {
    return false
  }
  return true
}

export async function verifyWarehousePersisted(
  id: string,
  expected: { name: string; code: string; city?: string },
): Promise<boolean> {
  try {
    const overview = await fetchWmsOverview()
    const warehouse = overview.warehouses.find((w) => w.id === id)
    if (!warehouse) return verifyPersisted(false, 'Warehouse did not persist on server')
    return verifyWarehouseResponse(warehouse, expected)
  } catch {
    toastFail('Could not verify warehouse on server')
    return false
  }
}

export function verifyStockMovementResponse(
  saved: unknown,
  expected: { sku: string; delta: number },
): boolean {
  const movement =
    saved && typeof saved === 'object' && 'movement' in saved
      ? (saved as { movement: WmsMovement }).movement
      : (saved as WmsMovement)
  if (!hasId(movement)) return verifyPersisted(false, 'Stock movement did not persist on server')
  if (!verifyStringEquals(movement.sku ?? '', expected.sku, 'Movement SKU')) return false
  return verifyNumberEquals(movement.delta, expected.delta, 'Movement delta')
}

export async function verifyStockMovementPersisted(
  id: string,
  expected: { sku: string; delta: number },
): Promise<boolean> {
  try {
    const overview = await fetchWmsOverview()
    const movement = overview.movements.find((m) => m.id === id)
    if (!movement) return verifyPersisted(false, 'Stock movement did not persist on server')
    return verifyStockMovementResponse(movement, expected)
  } catch {
    toastFail('Could not verify stock movement on server')
    return false
  }
}

export function verifyStockTransferResponse(
  saved: unknown,
  expected: { status?: string },
): boolean {
  const transfer =
    saved && typeof saved === 'object' && 'transfer' in saved
      ? (saved as { transfer: WmsTransfer }).transfer
      : (saved as WmsTransfer)
  if (!hasId(transfer)) return verifyPersisted(false, 'Stock transfer did not persist on server')
  if (expected.status !== undefined && !verifyStringEquals(transfer.status, expected.status, 'Transfer status')) {
    return false
  }
  return true
}

export async function verifyStockTransferPersisted(
  id: string,
  expected: { status?: string },
): Promise<boolean> {
  try {
    const overview = await fetchWmsOverview()
    const transfer = overview.transfers.find((t) => t.id === id)
    if (!transfer) return verifyPersisted(false, 'Stock transfer did not persist on server')
    return verifyStockTransferResponse(transfer, expected)
  } catch {
    toastFail('Could not verify stock transfer on server')
    return false
  }
}
