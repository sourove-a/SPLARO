import { toastFail } from './feedback'
import { deepEqual } from './settings-save'
import { fetchOrder } from '@/lib/api/orders'

/** Return false and show red toast when a persistence check fails. */
export function verifyPersisted(ok: boolean, reason = 'Save did not persist on server'): boolean {
  if (!ok) {
    toastFail(reason)
    return false
  }
  return true
}

export function verifyStringEquals(got: unknown, expected: string, label: string): boolean {
  return verifyPersisted(String(got ?? '').trim() === expected.trim(), `${label} did not persist on server`)
}

export function verifyBooleanEquals(got: unknown, expected: boolean, label: string): boolean {
  return verifyPersisted(Boolean(got) === expected, `${label} did not persist on server`)
}

export function verifyNumberEquals(got: unknown, expected: number, label: string): boolean {
  return verifyPersisted(Number(got) === expected, `${label} did not persist on server`)
}

export function verifyDeepEquals(got: unknown, expected: unknown, label: string): boolean {
  return verifyPersisted(deepEqual(got, expected), `${label} did not persist on server`)
}

export function verifyOrderStatus(saved: unknown, expectedStatus: string): boolean {
  const status =
    saved && typeof saved === 'object' && 'status' in saved
      ? String((saved as { status: unknown }).status)
      : ''
  return verifyPersisted(status === expectedStatus, 'Order status did not persist on server')
}

export function verifyDeleteSuccess(saved: unknown): boolean {
  const ok = Boolean(
    saved &&
      typeof saved === 'object' &&
      'success' in saved &&
      (saved as { success: unknown }).success === true,
  )
  return verifyPersisted(ok, 'Delete did not persist on server')
}

export function verifyBannerDeleteSuccess(saved: unknown): boolean {
  const ok = Boolean(
    saved &&
      typeof saved === 'object' &&
      'deleted' in saved &&
      (saved as { deleted: unknown }).deleted === true,
  )
  return verifyPersisted(ok, 'Banner delete did not persist on server')
}

export function verifyPaymentStatus(saved: unknown, expectedStatus: string): boolean {
  const status =
    saved && typeof saved === 'object' && 'paymentStatus' in saved
      ? String((saved as { paymentStatus: unknown }).paymentStatus)
      : ''
  return verifyPersisted(status === expectedStatus, 'Payment status did not persist on server')
}

export function verifyCodRisk(saved: unknown, expected: boolean): boolean {
  const got =
    saved && typeof saved === 'object' && 'isCodRisk' in saved
      ? (saved as { isCodRisk: unknown }).isCodRisk
      : undefined
  return verifyBooleanEquals(got, expected, 'COD risk flag')
}

export function verifyReturnStatus(saved: unknown, expectedStatus: string): boolean {
  const status =
    saved && typeof saved === 'object' && 'status' in saved
      ? String((saved as { status: unknown }).status).toLowerCase()
      : ''
  return verifyPersisted(
    status === expectedStatus.toLowerCase(),
    'Return status did not persist on server',
  )
}

export function verifyOrderNote(saved: unknown, expectedBody: string): boolean {
  const body =
    saved && typeof saved === 'object' && 'body' in saved
      ? String((saved as { body: unknown }).body).trim()
      : ''
  return verifyPersisted(body === expectedBody.trim(), 'Order note did not persist on server')
}

export function verifyCourierConsignment(order: unknown, expectedConsignmentId?: string): boolean {
  const cid =
    order && typeof order === 'object' && 'courier' in order
      ? String(
          (order as { courier?: { consignmentId?: string | null } | null }).courier?.consignmentId ?? '',
        ).trim()
      : ''
  if (!cid || cid.startsWith('DEV-')) {
    return verifyPersisted(false, 'Courier consignment did not persist on server')
  }
  if (expectedConsignmentId && cid !== expectedConsignmentId.trim()) {
    return verifyPersisted(false, 'Courier consignment did not persist on server')
  }
  return true
}

export async function verifyOrderPaymentPersisted(
  orderId: string,
  expectedStatus: string,
): Promise<boolean> {
  try {
    const fresh = await fetchOrder(orderId)
    return verifyPaymentStatus(fresh, expectedStatus)
  } catch {
    toastFail('Could not verify payment status on server')
    return false
  }
}

export async function verifyCourierBookingPersisted(
  orderId: string,
  expectedConsignmentId: string,
): Promise<boolean> {
  try {
    const fresh = await fetchOrder(orderId)
    return verifyCourierConsignment(fresh, expectedConsignmentId)
  } catch {
    toastFail('Could not verify courier booking on server')
    return false
  }
}
