/**
 * Admin-only helpers for order IP / device fraud review signals.
 * Never send these summaries to storefront/public serializers.
 */

/** Rolling window for volume flags — reduces CGNAT / office Wi-Fi false positives. */
export const FRAUD_SIGNAL_WINDOW_DAYS = 30

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

export function isPrivateOrLoopbackIp(ip: string | null | undefined): boolean {
  if (!ip?.trim()) return true
  const v = ip.trim().toLowerCase()
  if (v === '::1' || v === '127.0.0.1' || v === 'localhost') return true
  if (v.startsWith('10.') || v.startsWith('192.168.') || v.startsWith('127.')) return true
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(v)) return true
  if (v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80:')) return true
  return false
}

export type FraudSignalFlag =
  | 'Repeated device across multiple phones'
  | 'High order volume from one IP (30d)'
  | 'High order volume from one device (30d)'

export interface CustomerFraudSignals {
  lastIp: string | null
  lastDeviceIdMasked: string | null
  lastDeviceSummary: string | null
  sameIpOrderCount: number
  sameDeviceOrderCount: number
  distinctPhonesOnDevice: number
  distinctPhonesOnIp: number
  firstSeenAt: string | null
  firstSeenAtIp: string | null
  firstSeenAtDevice: string | null
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
  ipIsPrivate?: boolean
}): FraudSignalFlag[] {
  const flags: FraudSignalFlag[] = []
  if (input.distinctPhonesOnDevice >= 3) {
    flags.push('Repeated device across multiple phones')
  }
  // IP volume alone is noisy on CGNAT — require multi-phone OR high volume, skip private IPs.
  if (
    !input.ipIsPrivate &&
    input.sameIpOrderCount >= 8 &&
    input.distinctPhonesOnIp >= 2
  ) {
    flags.push('High order volume from one IP (30d)')
  }
  if (input.sameDeviceOrderCount >= 5) {
    flags.push('High order volume from one device (30d)')
  }
  return flags
}
