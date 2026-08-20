import type { TelegramHealthSnapshot } from './telegram.types'

export type TelegramOperationalState = 'online' | 'degraded' | 'offline' | 'unconfigured'

export interface TelegramOperationalView {
  state: TelegramOperationalState
  chipLabel: string
  syncLabel: string
  transportValue: string
  transportDetail: string
}

export function webhookUrlsMatch(expected: string | null | undefined, actual: string | null | undefined): boolean {
  if (!expected?.trim() || !actual?.trim()) return false
  const norm = (url: string) => url.trim().replace(/\/+$/, '').toLowerCase()
  return norm(expected) === norm(actual)
}

export function resolveTelegramTransportMode(input: {
  botPresent: boolean
  tokenConfigured: boolean
  webhookUrl: string | null | undefined
  pollingEnabled: boolean
}): TelegramHealthSnapshot['transportMode'] {
  if (!input.botPresent && !input.tokenConfigured) return 'disabled'
  if (input.webhookUrl?.trim()) return 'webhook'
  if (input.pollingEnabled) return 'polling'
  return 'send-only'
}

function liveTransportValue(input: {
  transportMode: TelegramHealthSnapshot['transportMode']
  webhookRegistered: boolean
}): string {
  if (input.webhookRegistered || input.transportMode === 'webhook') return 'webhook'
  if (input.transportMode === 'polling') return 'polling'
  if (input.transportMode === 'send-only') return 'send-only'
  return 'webhook'
}

function liveTransportDetail(input: {
  transportMode: TelegramHealthSnapshot['transportMode']
  webhookRegistered: boolean
  delivering: boolean
}): string {
  if (input.webhookRegistered) return 'webhook registered'
  if (input.transportMode === 'polling') return 'polling active'
  if (input.delivering) return 'messages delivering'
  if (input.transportMode === 'send-only') return 'send-only'
  return 'bot reachable'
}

function liveSyncLabel(input: {
  transportMode: TelegramHealthSnapshot['transportMode']
  webhookRegistered: boolean
}): string {
  if (input.webhookRegistered || input.transportMode === 'webhook') return 'Online · webhook'
  if (input.transportMode === 'polling') return 'Online · polling'
  return 'Online · send-only'
}

/**
 * One authoritative bot status. Deliveries + registered webhook beat a stale
 * `transportMode: disabled` probe (health GET timing out on getMe).
 */
export function resolveTelegramOperationalView(input: {
  tokenConfigured: boolean
  botRunning: boolean
  transportMode: TelegramHealthSnapshot['transportMode']
  webhookRegistered: boolean
  networkVerified: boolean
  lastDeliveryStatus: TelegramHealthSnapshot['lastDeliveryStatus']
  recentSuccesses: number
}): TelegramOperationalView {
  const delivering = input.lastDeliveryStatus === 'success' || input.recentSuccesses > 0
  const liveBits = {
    transportMode: input.transportMode,
    webhookRegistered: input.webhookRegistered,
    delivering,
  }

  if (!input.tokenConfigured) {
    return {
      state: 'unconfigured',
      chipLabel: 'NOT LINKED',
      syncLabel: 'configure bot token + chat',
      transportValue: 'off',
      transportDetail: 'no bot token',
    }
  }

  const online =
    (input.webhookRegistered && (input.botRunning || delivering)) ||
    (input.botRunning && (input.networkVerified || input.transportMode !== 'disabled')) ||
    delivering

  if (online && input.lastDeliveryStatus !== 'failed') {
    return {
      state: 'online',
      chipLabel: 'ONLINE',
      syncLabel: liveSyncLabel(input),
      transportValue: 'Online',
      transportDetail: liveTransportDetail(liveBits),
    }
  }

  if (online && input.lastDeliveryStatus === 'failed' && input.recentSuccesses > 0) {
    return {
      state: 'online',
      chipLabel: 'ONLINE',
      syncLabel: liveSyncLabel(input),
      transportValue: 'Online',
      transportDetail: liveTransportDetail(liveBits),
    }
  }

  if (input.lastDeliveryStatus === 'failed') {
    return {
      state: 'degraded',
      chipLabel: 'DEGRADED',
      syncLabel: 'last send failed',
      transportValue: liveTransportValue(input),
      transportDetail: 'last delivery failed',
    }
  }

  return {
    state: 'offline',
    chipLabel: 'OFFLINE',
    syncLabel: 'token saved · bot not reachable',
    transportValue: input.transportMode === 'disabled' ? 'off' : input.transportMode,
    transportDetail: 'needs verification',
  }
}
