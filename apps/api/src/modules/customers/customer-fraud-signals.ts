/**
 * Admin-only helpers for order IP / device fraud review signals.
 * Never send these summaries to storefront/public serializers.
 */

export function summarizeUserAgent(userAgent: string | null | undefined): string {
  if (!userAgent?.trim()) return 'Unknown device'
  const ua = userAgent
  const device = /Mobile|Android|iPhone|iPad/i.test(ua) ? 'Mobile' : 'Desktop'
  let browser = 'Browser'
  if (/Edg\//i.test(ua)) browser = 'Edge'
  else if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) browser = 'Chrome'
  else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browser = 'Safari'
  else if (/Firefox\//i.test(ua)) browser = 'Firefox'
  return `${device} · ${browser}`
}

export function maskDeviceId(deviceId: string | null | undefined): string | null {
  if (!deviceId?.trim()) return null
  const id = deviceId.trim()
  if (id.length <= 12) return id
  return `${id.slice(0, 8)}…${id.slice(-4)}`
}

export type FraudSignalFlag =
  | 'Repeated device across multiple phones'
  | 'High order volume from one IP'
  | 'High order volume from one device'

export interface CustomerFraudSignals {
  lastIp: string | null
  lastDeviceIdMasked: string | null
  lastDeviceSummary: string | null
  sameIpOrderCount: number
  sameDeviceOrderCount: number
  distinctPhonesOnDevice: number
  distinctPhonesOnIp: number
  firstSeenAt: string | null
  lastSeenAt: string | null
  flags: FraudSignalFlag[]
  /** True when no recent order captured IP/device (legacy orders). */
  captured: boolean
}

export function buildFraudFlags(input: {
  sameIpOrderCount: number
  sameDeviceOrderCount: number
  distinctPhonesOnDevice: number
  distinctPhonesOnIp: number
}): FraudSignalFlag[] {
  const flags: FraudSignalFlag[] = []
  if (input.distinctPhonesOnDevice >= 3) {
    flags.push('Repeated device across multiple phones')
  }
  if (input.sameIpOrderCount >= 5) {
    flags.push('High order volume from one IP')
  }
  if (input.sameDeviceOrderCount >= 5) {
    flags.push('High order volume from one device')
  }
  return flags
}
