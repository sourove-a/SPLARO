import toast from 'react-hot-toast'

const OK_CLASS = 'admin-toast admin-toast--ok'
const FAIL_CLASS = 'admin-toast admin-toast--fail'
const WARN_CLASS = 'admin-toast admin-toast--warn'
const INFO_CLASS = 'admin-toast admin-toast--info'

/** Verified success — green signal. */
export function toastOk(message: string, id?: string) {
  toast.success(message, {
    id: id ?? message,
    duration: 3400,
    className: OK_CLASS,
  })
}

/** Real failure — red signal. */
export function toastFail(message: string, id?: string) {
  toast.error(message, {
    id: id ?? `err:${message}`,
    duration: 4800,
    className: FAIL_CLASS,
  })
}

/** Partial success or caution — amber signal. */
export function toastWarn(message: string, id?: string) {
  toast(message, {
    id: id ?? `warn:${message}`,
    duration: 4200,
    className: WARN_CLASS,
    icon: '⚠',
  })
}

/** Neutral info — not success, not error. */
export function toastInfo(message: string) {
  toast(message, {
    id: `info:${message}`,
    duration: 3600,
    className: INFO_CLASS,
    icon: 'ℹ',
  })
}

/** Verified API persistence — green only after server confirms. */
export function toastApiSaved(label: string) {
  toastOk(`${label} saved to server.`, `api-saved:${label}`)
}

/** Backend write/read missing — amber only, never success. */
export function notifyBackendMissing(action: string) {
  toastWarn(`Backend not connected for ${action}. No data was saved.`, `backend-missing:${action}`)
}

/** Tooltip/title for disabled admin actions with no API. */
export const BACKEND_NOT_CONNECTED_TITLE =
  'Backend not connected — this action is not available yet.'

/** Google Search Console — external OAuth not wired in single-store launch. */
export const GSC_REQUIRED_TITLE =
  'Requires Google Search Console — connect in Google Workspace first.'

/** @deprecated Prefer notifyBackendMissing — kept for call-site compatibility. */
export function toastNotImplemented(action: string) {
  notifyBackendMissing(action)
}

export interface CourierBookingResponse {
  success: boolean
  consignmentId?: string
  trackingCode?: string
  error?: string
  simulated?: boolean
  alreadyBooked?: boolean
}

/** Honest courier feedback — never green when courier API is not really connected. */
export function toastCourierResult(res: CourierBookingResponse, orderLabel?: string) {
  const prefix = orderLabel ? `${orderLabel}: ` : ''

  if (res.simulated && res.success) {
    toastWarn(`${prefix}Simulated booking (dev mode) — not sent to Steadfast.`)
    return
  }

  if (res.alreadyBooked && res.success) {
    if (res.consignmentId?.startsWith('DEV-')) {
      toastWarn(`${prefix}Dev-only booking on file — not sent to Steadfast. Add real API keys and re-book.`)
      return
    }
    toastInfo(`${prefix}Already booked${res.consignmentId ? ` · ${res.consignmentId}` : ''}.`)
    return
  }

  if (res.success && res.consignmentId && !res.consignmentId.startsWith('DEV-')) {
    toastOk(`${prefix}Courier booked · ${res.consignmentId}`)
    return
  }

  if (res.success && res.consignmentId?.startsWith('DEV-')) {
    toastFail(`${prefix}Courier not connected — add real Steadfast API keys and retry.`)
    return
  }

  toastFail(res.error ?? `${prefix}Courier booking failed — check API credentials.`)
}

export interface BulkOpResult {
  booked?: number
  updated?: number
  failed?: number
  results?: Array<{ success: boolean; error?: string; orderId?: string }>
}

/** Bulk ops — green only when all succeed; red when all fail; amber when partial. */
export function toastBulkOpResult(
  res: BulkOpResult,
  labels: {
    ok: (count: number) => string
    partial?: (ok: number, fail: number) => string
    fail: string
  },
) {
  const ok = res.booked ?? res.updated ?? 0
  const fail = res.failed ?? 0
  const firstErr = res.results?.find((r) => !r.success)?.error

  if (ok === 0 && fail > 0) {
    toastFail(firstErr ? `${labels.fail} · ${firstErr}` : labels.fail)
    return
  }

  if (ok > 0 && fail > 0) {
    const msg = labels.partial?.(ok, fail) ?? `${ok} succeeded, ${fail} failed.`
    toastWarn(firstErr ? `${msg} · ${firstErr}` : msg)
    return
  }

  if (ok > 0) {
    toastOk(labels.ok(ok))
    return
  }

  toastFail(labels.fail)
}

/** Await refetch, toast only on real success. */
export async function refreshWithToast(
  refetch: () => Promise<unknown>,
  successMsg: string,
  failMsg = 'Refresh failed',
) {
  try {
    await refetch()
    toastOk(successMsg, `refresh:${successMsg}`)
  } catch (err) {
    toastFail(err instanceof Error ? err.message : failMsg, `refresh-fail:${successMsg}`)
  }
}
