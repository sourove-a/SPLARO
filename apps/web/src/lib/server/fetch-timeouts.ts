/** Shared upstream fetch tuning — fast-fail in local dev when API is offline. */

import { isCiOrProductionBuild } from '@/lib/server/build-safe-fetch'

export function isLocalDevRuntime(): boolean {
  return process.env.NODE_ENV === 'development'
}

function envMs(key: string, devDefault: number, prodDefault: number): number {
  const raw = Number(process.env[key])
  if (Number.isFinite(raw) && raw > 0) return raw
  if (isCiOrProductionBuild()) return 400
  return isLocalDevRuntime() ? devDefault : prodDefault
}

export function catalogFetchTimeoutMs(): number {
  return envMs('SPLARO_CATALOG_FETCH_TIMEOUT_MS', 2500, 8000)
}

export function catalogFetchAttempts(): number {
  if (isCiOrProductionBuild()) return 1
  const raw = Number(process.env.SPLARO_CATALOG_FETCH_ATTEMPTS)
  if (Number.isFinite(raw) && raw >= 1) return Math.floor(raw)
  return isLocalDevRuntime() ? 1 : 2
}

export function settingsFetchTimeoutMs(): number {
  return envMs('SPLARO_SETTINGS_FETCH_TIMEOUT_MS', 2500, 8000)
}

export function upstreamFetchTimeoutMs(): number {
  return envMs('SPLARO_UPSTREAM_FETCH_TIMEOUT_MS', 4000, 8000)
}
