'use client'

import { useCallback, useEffect, useState } from 'react'

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

export function useAdminConnection(intervalMs = 20_000): AdminConnectionState {
  const [api, setApi] = useState<ServiceConnection>(CHECKING)
  const [storefront, setStorefront] = useState<ServiceConnection>(CHECKING)
  const [database, setDatabase] = useState<ServiceConnection>(CHECKING)
  const [lastChecked, setLastChecked] = useState<Date | null>(null)
  const [checking, setChecking] = useState(true)

  const refresh = useCallback(async () => {
    setChecking(true)
    try {
      let data: PingResponse | null = null

      try {
        const res = await fetch('/api/ping', { cache: 'no-store', signal: AbortSignal.timeout(30000) })
        if (res.ok) {
          data = (await res.json()) as PingResponse
        }
      } catch {
        /* try fallback */
      }

      if (!data) {
        const res = await fetch('/api/proxy/health', {
          cache: 'no-store',
          signal: AbortSignal.timeout(8000),
        })
        const online = res.ok
        let databaseOnline = false
        if (online) {
          try {
            const fullRes = await fetch('/api/proxy/health/full', {
              cache: 'no-store',
              signal: AbortSignal.timeout(8000),
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
              message: online ? 'HTTP 200' : isProd ? 'API unreachable — check VPS splaro-api' : 'Start pnpm dev:api',
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
        setApi(mapService(services.api))
        setStorefront(mapService(services.storefront))
        setDatabase(mapService(services.database))
      } else {
        const online = Boolean(data.online)
        setApi({
          pulse: toPulse(online),
          latencyMs: typeof data.latencyMs === 'number' ? data.latencyMs : null,
        })
        setStorefront({ pulse: 'offline', latencyMs: null, message: 'Storefront probe unavailable' })
        setDatabase({ pulse: online ? 'degraded' : 'offline', latencyMs: null })
      }

      setLastChecked(data.checkedAt ? new Date(data.checkedAt) : new Date())
    } catch {
      setApi({ pulse: 'offline', latencyMs: null, message: isProd ? 'Admin API proxy unreachable' : 'Admin proxy unreachable — restart pnpm dev:admin' })
      setStorefront({ pulse: 'offline', latencyMs: null })
      setDatabase({ pulse: 'offline', latencyMs: null })
      setLastChecked(new Date())
    } finally {
      setChecking(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    const id = window.setInterval(() => void refresh(), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs, refresh])

  return { api, storefront, database, lastChecked, checking, refresh }
}
