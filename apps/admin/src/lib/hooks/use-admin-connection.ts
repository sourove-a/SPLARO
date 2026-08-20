'use client'

import { useCallback, useSyncExternalStore } from 'react'

const isProd = process.env.NODE_ENV === 'production'

export type ConnectionPulse = 'checking' | 'online' | 'degraded' | 'offline'

export interface ServiceConnection {
  pulse: ConnectionPulse
  latencyMs: number | null
  message?: string
}

export interface AdminConnectionState {
  api: ServiceConnection
  storefront: ServiceConnection
  database: ServiceConnection
  lastChecked: Date | null
  checking: boolean
  refresh: () => Promise<void>
}

type PingResponse = {
  online?: boolean
  latencyMs?: number | null
  checkedAt?: string
  services?: {
    api?: { online?: boolean; latencyMs?: number | null; message?: string }
    storefront?: { online?: boolean; latencyMs?: number | null; message?: string }
    database?: { online?: boolean; latencyMs?: number | null; message?: string }
  }
}

export const HEALTH_INTERVAL_MS = 30_000
const COOLDOWN_MS = 12_000
const OFFLINE_AFTER_FAILURES = 2
const PING_TIMEOUT_MS = 15_000
const FALLBACK_TIMEOUT_MS = 8_000

const CHECKING: ServiceConnection = { pulse: 'checking', latencyMs: null }

function toPulse(online: boolean | undefined, degraded?: boolean): ConnectionPulse {
  if (online === undefined) return 'checking'
  if (!online) return 'offline'
  if (degraded) return 'degraded'
  return 'online'
}

function mapService(row?: { online?: boolean; latencyMs?: number | null; message?: string }): ServiceConnection {
  if (!row) return { pulse: 'offline', latencyMs: null }
  if (row.online === undefined) {
    return {
      pulse: 'degraded',
      latencyMs: typeof row.latencyMs === 'number' ? row.latencyMs : null,
      message: row.message ?? 'Status unknown',
    }
  }
  return {
    pulse: toPulse(row.online, row.message?.includes('degraded')),
    latencyMs: typeof row.latencyMs === 'number' ? row.latencyMs : null,
    ...(row.message ? { message: row.message } : {}),
  }
}

type Snapshot = {
  api: ServiceConnection
  storefront: ServiceConnection
  database: ServiceConnection
  lastChecked: Date | null
  checking: boolean
}

let snapshot: Snapshot = {
  api: CHECKING,
  storefront: CHECKING,
  database: CHECKING,
  lastChecked: null,
  checking: true,
}

const listeners = new Set<() => void>()
let intervalId: number | null = null
let inFlight: Promise<void> | null = null
let subscriberCount = 0
let consecutiveFailures = 0
let lastSuccessAt = 0
let lastAttemptAt = 0

function emit() {
  for (const listener of listeners) listener()
}

function setSnapshot(next: Partial<Snapshot>) {
  snapshot = { ...snapshot, ...next }
  emit()
}

function hadSuccessfulPing(): boolean {
  return snapshot.lastChecked != null && snapshot.api.pulse !== 'checking'
}

function applyPingFailure(message: string, confirmed = false) {
  consecutiveFailures += confirmed ? OFFLINE_AFTER_FAILURES : 1
  if (hadSuccessfulPing() && consecutiveFailures < OFFLINE_AFTER_FAILURES) {
    setSnapshot({ checking: false })
    return
  }
  setSnapshot({
    api: {
      pulse: 'offline',
      latencyMs: null,
      message,
    },
    storefront: { pulse: 'offline', latencyMs: null },
    database: { pulse: 'offline', latencyMs: null },
    lastChecked: new Date(),
    checking: false,
  })
}

async function runPing(opts?: { force?: boolean }): Promise<void> {
  if (inFlight) return inFlight

  const now = Date.now()
  if (!opts?.force) {
    if (lastSuccessAt && now - lastSuccessAt < COOLDOWN_MS) return
    if (lastAttemptAt && now - lastAttemptAt < COOLDOWN_MS && hadSuccessfulPing()) return
  }

  lastAttemptAt = now

  inFlight = (async () => {
    setSnapshot({ checking: true })
    try {
      let data: PingResponse | null = null

      try {
        const res = await fetch('/api/ping', {
          cache: 'no-store',
          signal: AbortSignal.timeout(PING_TIMEOUT_MS),
        })
        if (res.ok) {
          data = (await res.json()) as PingResponse
        }
      } catch {
        /* try fallback */
      }

      if (!data) {
        const res = await fetch('/api/proxy/health', {
          cache: 'no-store',
          signal: AbortSignal.timeout(FALLBACK_TIMEOUT_MS),
        })
        const online = res.ok
        let databaseOnline = false
        if (online) {
          try {
            const fullRes = await fetch('/api/proxy/health/full', {
              cache: 'no-store',
              signal: AbortSignal.timeout(FALLBACK_TIMEOUT_MS),
            })
            if (fullRes.ok) {
              const full = (await fullRes.json()) as {
                checks?: { id: string; status: string }[]
              }
              databaseOnline = full.checks?.find((c) => c.id === 'postgresql')?.status === 'healthy'
            }
          } catch {
            /* optional */
          }
        }
        if (!online) {
          applyPingFailure(
            isProd ? 'Admin API proxy unreachable' : 'Admin proxy unreachable — restart pnpm dev:admin',
          )
          return
        }
        data = {
          online,
          latencyMs: null,
          checkedAt: new Date().toISOString(),
          services: {
            api: {
              online,
              message: online
                ? 'HTTP 200'
                : isProd
                  ? 'API unreachable — check VPS splaro-api'
                  : 'Start pnpm dev:api',
            },
            storefront: {
              message: isProd
                ? 'Storefront status unknown (ping fallback)'
                : 'Storefront not probed on health fallback',
            },
            database: { online: databaseOnline },
          },
        }
      }

      const services = data.services
      const apiPulse = services ? mapService(services.api).pulse : toPulse(Boolean(data.online))
      if (apiPulse === 'offline') {
        applyPingFailure(services?.api?.message ?? 'API unreachable', true)
        return
      }

      consecutiveFailures = 0
      lastSuccessAt = Date.now()

      if (services) {
        setSnapshot({
          api: mapService(services.api),
          storefront: mapService(services.storefront),
          database: mapService(services.database),
          lastChecked: data.checkedAt ? new Date(data.checkedAt) : new Date(),
          checking: false,
        })
      } else {
        const online = Boolean(data.online)
        setSnapshot({
          api: {
            pulse: toPulse(online),
            latencyMs: typeof data.latencyMs === 'number' ? data.latencyMs : null,
          },
          storefront: { pulse: 'offline', latencyMs: null, message: 'Storefront probe unavailable' },
          database: { pulse: online ? 'degraded' : 'offline', latencyMs: null },
          lastChecked: data.checkedAt ? new Date(data.checkedAt) : new Date(),
          checking: false,
        })
      }
    } catch {
      applyPingFailure(
        isProd ? 'Admin API proxy unreachable' : 'Admin proxy unreachable — restart pnpm dev:admin',
      )
    } finally {
      inFlight = null
    }
  })()

  return inFlight
}

function ensureInterval() {
  if (typeof window === 'undefined') return
  if (intervalId !== null) return
  intervalId = window.setInterval(() => void runPing(), HEALTH_INTERVAL_MS)
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  subscriberCount += 1
  if (subscriberCount === 1) {
    const stale = !lastSuccessAt || Date.now() - lastSuccessAt >= HEALTH_INTERVAL_MS
    if (stale) void runPing()
    ensureInterval()
  }
  return () => {
    listeners.delete(listener)
    subscriberCount = Math.max(0, subscriberCount - 1)
    if (subscriberCount === 0 && intervalId !== null) {
      window.clearInterval(intervalId)
      intervalId = null
    }
  }
}

function getSnapshot(): Snapshot {
  return snapshot
}

/** Must stay referentially stable — a fresh object each call makes React loop. */
const SERVER_SNAPSHOT: Snapshot = {
  api: CHECKING,
  storefront: CHECKING,
  database: CHECKING,
  lastChecked: null,
  checking: true,
}

function getServerSnapshot(): Snapshot {
  return SERVER_SNAPSHOT
}

/**
 * Platform connection pulse for Nest / storefront / DB.
 * All callers share one 30s poller — the interval argument is accepted for
 * call-site compatibility and does not start extra probes.
 */
export function useAdminConnection(_intervalMs = HEALTH_INTERVAL_MS): AdminConnectionState {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const refresh = useCallback(async () => {
    await runPing({ force: true })
  }, [])

  return {
    api: state.api,
    storefront: state.storefront,
    database: state.database,
    lastChecked: state.lastChecked,
    checking: state.checking,
    refresh,
  }
}
