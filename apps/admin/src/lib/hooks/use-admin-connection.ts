'use client'

import { useCallback, useEffect, useSyncExternalStore } from 'react'

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

const CHECKING: ServiceConnection = { pulse: 'checking', latencyMs: null }

function toPulse(online: boolean | undefined, degraded?: boolean): ConnectionPulse {
  if (online === undefined) return 'checking'
  if (!online) return 'offline'
  if (degraded) return 'degraded'
  return 'online'
}

function mapService(row?: { online?: boolean; latencyMs?: number | null; message?: string }): ServiceConnection {
  if (!row) return { pulse: 'offline', latencyMs: null }
  return {
    pulse: toPulse(row.online, row.message?.includes('degraded')),
    latencyMs: typeof row.latencyMs === 'number' ? row.latencyMs : null,
    ...(row.message ? { message: row.message } : {}),
  }
}

/** Shared poller — one /api/ping for the whole admin shell (not per-component). */
const DEFAULT_INTERVAL_MS = 45_000
const PING_TIMEOUT_MS = 8_000

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
let activeIntervalMs = DEFAULT_INTERVAL_MS

function emit() {
  for (const listener of listeners) listener()
}

function setSnapshot(next: Partial<Snapshot>) {
  snapshot = { ...snapshot, ...next }
  emit()
}

async function runPing(): Promise<void> {
  if (inFlight) return inFlight

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
          signal: AbortSignal.timeout(5_000),
        })
        const online = res.ok
        let databaseOnline = false
        if (online) {
          try {
            const fullRes = await fetch('/api/proxy/health/full', {
              cache: 'no-store',
              signal: AbortSignal.timeout(5_000),
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
              online: false,
              message: isProd ? 'Storefront probe unavailable' : 'Start pnpm dev:web',
            },
            database: { online: databaseOnline },
          },
        }
      }

      const services = data.services

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
      setSnapshot({
        api: {
          pulse: 'offline',
          latencyMs: null,
          message: isProd
            ? 'Admin API proxy unreachable'
            : 'Admin proxy unreachable — restart pnpm dev:admin',
        },
        storefront: { pulse: 'offline', latencyMs: null },
        database: { pulse: 'offline', latencyMs: null },
        lastChecked: new Date(),
        checking: false,
      })
    } finally {
      inFlight = null
    }
  })()

  return inFlight
}

function ensureInterval(intervalMs: number) {
  activeIntervalMs = Math.min(activeIntervalMs, intervalMs)
  if (typeof window === 'undefined') return
  if (intervalId !== null) {
    window.clearInterval(intervalId)
  }
  intervalId = window.setInterval(() => void runPing(), activeIntervalMs)
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  subscriberCount += 1
  if (subscriberCount === 1) {
    void runPing()
    ensureInterval(activeIntervalMs)
  }
  return () => {
    listeners.delete(listener)
    subscriberCount = Math.max(0, subscriberCount - 1)
    if (subscriberCount === 0 && intervalId !== null) {
      window.clearInterval(intervalId)
      intervalId = null
      activeIntervalMs = DEFAULT_INTERVAL_MS
    }
  }
}

function getSnapshot(): Snapshot {
  return snapshot
}

function getServerSnapshot(): Snapshot {
  return {
    api: CHECKING,
    storefront: CHECKING,
    database: CHECKING,
    lastChecked: null,
    checking: true,
  }
}

/**
 * Platform connection pulse for Nest / storefront / DB.
 * All callers share one poller — avoids stampeding `/api/ping` from sidebar + header + panels.
 */
export function useAdminConnection(intervalMs = DEFAULT_INTERVAL_MS): AdminConnectionState {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  useEffect(() => {
    if (intervalMs < activeIntervalMs) {
      ensureInterval(intervalMs)
    }
  }, [intervalMs])

  const refresh = useCallback(async () => {
    await runPing()
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
