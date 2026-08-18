import type { DcTone } from './tokens'

type QueryLike = { error?: unknown; isError?: boolean; isLoading?: boolean }

export type ConnectionPulseLike = 'checking' | 'online' | 'degraded' | 'offline'

/** Map `/api/ping` pulse → page chip. Never call degraded “LIVE”. */
export function dcConnectionChip(pulse: ConnectionPulseLike): { label: string; tone: DcTone } | null {
  if (pulse === 'offline') return { label: 'API OFFLINE', tone: 'bad' }
  if (pulse === 'degraded') return { label: 'DEGRADED', tone: 'warn' }
  if (pulse === 'checking') return { label: 'SYNCING', tone: 'mute' }
  return null
}

/**
 * Page chip — connection first, then query errors, then loading, else LIVE
 * (or `okChip` when the module is beta / not a verified daily workflow).
 * Pass `connectionPulse` from `useAdminConnection().api.pulse` when available.
 */
export function dcPageStatus(
  sources: QueryLike[],
  connectionPulse?: ConnectionPulseLike,
  okChip?: { label: string; tone: DcTone },
): { label: string; tone: DcTone } {
  if (connectionPulse) {
    const conn = dcConnectionChip(connectionPulse)
    if (conn) return conn
  }
  if (sources.some((s) => s.error || s.isError)) {
    return { label: 'ERROR', tone: 'bad' }
  }
  if (sources.some((s) => s.isLoading)) {
    return { label: 'SYNCING', tone: 'mute' }
  }
  return okChip ?? { label: 'LIVE', tone: 'ok' }
}
