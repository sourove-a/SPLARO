import {
  toastCourierResult,
  toastApiSaved,
  toastInfo,
  toastWarn,
  toastBulkOpResult,
  type CourierBookingResponse,
} from './feedback'
import { verifyCourierBookingPersisted } from './mutation-verify'

export async function confirmCourierBookingSaved(
  res: CourierBookingResponse,
  orderId: string,
  orderLabel: string,
): Promise<boolean> {
  if (res.simulated && res.success) {
    toastCourierResult(res, orderLabel)
    return false
  }

  if (!res.success || !res.consignmentId || res.consignmentId.startsWith('DEV-')) {
    toastCourierResult(res, orderLabel)
    return false
  }

  if (!(await verifyCourierBookingPersisted(orderId, res.consignmentId))) return false

  if (res.alreadyBooked) {
    toastInfo(`${orderLabel}: Already booked · ${res.consignmentId}`)
    return true
  }

  toastApiSaved(`Courier ${orderLabel}`)
  return true
}

export function isRealCourierBooking(r: {
  success: boolean
  consignmentId?: string
  simulated?: boolean
}): boolean {
  return Boolean(
    r.success && r.consignmentId && !r.consignmentId.startsWith('DEV-') && !r.simulated,
  )
}

export async function verifyBulkCourierSamplePersisted(
  results: Array<{
    orderId: string
    success: boolean
    consignmentId?: string
    simulated?: boolean
  }>,
): Promise<boolean> {
  const sample = results.find((r) => isRealCourierBooking(r))
  if (!sample?.consignmentId) return true
  return verifyCourierBookingPersisted(sample.orderId, sample.consignmentId)
}

/** Bulk courier — green only for live Steadfast consignments (never DEV-* / simulated). */
export async function toastBulkCourierHonesty(res: {
  booked?: number
  failed?: number
  results?: Array<{
    orderId: string
    success: boolean
    consignmentId?: string
    simulated?: boolean
    error?: string
  }>
}): Promise<{ realBooked: number }> {
  const results = res.results ?? []
  const real = results.filter((r) => isRealCourierBooking(r))
  const simulated = results.filter(
    (r) => r.success && (r.simulated || (r.consignmentId?.startsWith('DEV-') ?? false)),
  )
  const hardFail = results.filter((r) => !r.success)

  if (real.length) {
    if (!(await verifyBulkCourierSamplePersisted(results))) {
      return { realBooked: 0 }
    }
  }

  if (simulated.length > 0 && real.length === 0) {
    toastWarn(
      `Simulated only — ${simulated.length} not sent to Steadfast. Save keys in Settings → Infrastructure.`,
      'bulk-courier-sim',
    )
    return { realBooked: 0 }
  }

  const failedAsSim = simulated.map((r) => ({
    ...r,
    success: false as const,
    error: r.error ?? 'Simulated / DEV booking — not live',
  }))

  toastBulkOpResult(
    {
      booked: real.length,
      failed: hardFail.length + simulated.length,
      results: [...real, ...hardFail, ...failedAsSim],
    },
    {
      ok: (n) => `Courier booked for ${n} order(s).`,
      partial: (ok, fail) => `Courier: ${ok} live booked, ${fail} failed or simulated.`,
      fail: 'Courier booking failed — Steadfast not connected or invalid keys.',
    },
  )

  return { realBooked: real.length }
}
