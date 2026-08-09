'use client'

import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { buildAdminApiUrl } from '@/lib/api/client'
import { getAdminApiToken } from '@/lib/auth/api-token'
import {
  consumeSseChunk,
  parseAdminRealtimeOrderEvent,
  shouldApplyRealtimeEvent,
} from './realtime-event'

const MAX_BACKOFF_MS = 15_000

export function useAdminOrdersRealtime(enabled = true): void {
  const qc = useQueryClient()
  const lastByOrder = useRef(new Map<string, { seq: number; updatedAt?: string }>())

  useEffect(() => {
    if (!enabled) return

    let cancelled = false
    let attempt = 0
    let retryTimer: ReturnType<typeof setTimeout> | undefined
    const abort = { current: null as AbortController | null }

    const invalidate = (orderId?: string) => {
      void qc.invalidateQueries({ queryKey: ['orders'] })
      void qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
      void qc.invalidateQueries({ queryKey: ['fulfillment-today-stats'] })
      if (orderId) void qc.invalidateQueries({ queryKey: ['order', orderId] })
    }

    const apply = (raw: unknown) => {
      const event = parseAdminRealtimeOrderEvent(raw)
      if (!event) return
      const prev = lastByOrder.current.get(event.orderId) ?? { seq: 0 }
      if (!shouldApplyRealtimeEvent(event, prev)) return
      lastByOrder.current.set(event.orderId, { seq: event.seq, updatedAt: event.updatedAt })
      invalidate(event.orderId)
    }

    const connect = async () => {
      if (cancelled) return
      abort.current?.abort()
      const controller = new AbortController()
      abort.current = controller
      const token = getAdminApiToken()
      try {
        const res = await fetch(buildAdminApiUrl('/realtime/admin/orders'), {
          credentials: 'include',
          headers: {
            Accept: 'text/event-stream',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          signal: controller.signal,
        })
        if (!res.ok || !res.body) throw new Error(`sse ${res.status}`)
        attempt = 0
        void qc.invalidateQueries({ queryKey: ['orders'] })
        void qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
        void qc.invalidateQueries({ queryKey: ['fulfillment-today-stats'] })

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        while (!cancelled) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          buffer = consumeSseChunk(buffer, apply)
        }
      } catch {
        /* reconnect below */
      }

      if (cancelled) return
      attempt += 1
      retryTimer = setTimeout(() => {
        void connect()
      }, Math.min(1000 * 2 ** (attempt - 1), MAX_BACKOFF_MS))
    }

    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return
      if (abort.current && !abort.current.signal.aborted) return
      attempt = 0
      void connect()
    }

    void connect()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      cancelled = true
      abort.current?.abort()
      if (retryTimer) clearTimeout(retryTimer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [enabled, qc])
}
