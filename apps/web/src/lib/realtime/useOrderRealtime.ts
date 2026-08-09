'use client'

import { useEffect, useRef, useState } from 'react'
import {
  parseRealtimeOrderEvent,
  shouldApplyRealtimeEvent,
  consumeSseChunk,
  type StorefrontRealtimeOrderEvent,
} from './realtime-event'

const FALLBACK_MS = 30_000
const MAX_BACKOFF_MS = 15_000

export function useOrderRealtime(options: {
  orderId?: string | null
  accessKey?: string | undefined
  phone?: string | undefined
  enabled?: boolean
  onEvent: (event: StorefrontRealtimeOrderEvent) => void
  onReconcile?: () => Promise<void> | void
}): { connected: boolean; liveHint: boolean } {
  const { orderId, accessKey, phone, enabled = true, onEvent, onReconcile } = options
  const [connected, setConnected] = useState(false)
  const [liveHint, setLiveHint] = useState(false)
  const lastSeq = useRef(0)
  const lastUpdatedAt = useRef<string | undefined>(undefined)
  const connectedRef = useRef(false)
  const onEventRef = useRef(onEvent)
  const onReconcileRef = useRef(onReconcile)
  onEventRef.current = onEvent
  onReconcileRef.current = onReconcile

  useEffect(() => {
    if (!enabled || !orderId?.trim()) {
      setConnected(false)
      return
    }

    let cancelled = false
    let retryTimer: ReturnType<typeof setTimeout> | undefined
    let hintTimer: ReturnType<typeof setTimeout> | undefined
    let attempt = 0
    const abort = { current: null as AbortController | null }

    const markLive = () => {
      setLiveHint(true)
      if (hintTimer) clearTimeout(hintTimer)
      hintTimer = setTimeout(() => setLiveHint(false), 4000)
    }

    const apply = (raw: unknown) => {
      const event = parseRealtimeOrderEvent(raw)
      if (!event) return
      if (event.orderId !== orderId && event.invoiceNumber !== orderId) return
      if (
        !shouldApplyRealtimeEvent(event, {
          seq: lastSeq.current,
          updatedAt: lastUpdatedAt.current,
        })
      ) {
        return
      }
      lastSeq.current = event.seq
      lastUpdatedAt.current = event.updatedAt
      onEventRef.current(event)
      markLive()
    }

    const reconnectDelay = () => Math.min(1000 * 2 ** attempt, MAX_BACKOFF_MS)

    const connect = async () => {
      if (cancelled) return
      abort.current?.abort()
      const controller = new AbortController()
      abort.current = controller
      const params = new URLSearchParams()
      if (accessKey) params.set('key', accessKey)
      if (phone) params.set('phone', phone)
      const qs = params.toString()
      const url = `/api/realtime/orders/${encodeURIComponent(orderId)}${qs ? `?${qs}` : ''}`

      try {
        const res = await fetch(url, {
          credentials: 'include',
          headers: { Accept: 'text/event-stream' },
          signal: controller.signal,
        })
        if (!res.ok || !res.body) {
          throw new Error(`sse ${res.status}`)
        }
        attempt = 0
        connectedRef.current = true
        setConnected(true)
        await onReconcileRef.current?.()

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        while (!cancelled) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          buffer = consumeSseChunk(buffer, apply)
        }
        connectedRef.current = false
        setConnected(false)
      } catch {
        connectedRef.current = false
        setConnected(false)
      }

      if (cancelled) return
      attempt += 1
      retryTimer = setTimeout(() => {
        void connect()
      }, reconnectDelay())
    }

    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return
      if (connectedRef.current) return
      attempt = 0
      void connect()
    }

    const fallbackTimer = setInterval(() => {
      if (cancelled || connectedRef.current) return
      void onReconcileRef.current?.()
    }, FALLBACK_MS)

    void connect()
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelled = true
      connectedRef.current = false
      setConnected(false)
      abort.current?.abort()
      if (retryTimer) clearTimeout(retryTimer)
      if (fallbackTimer) clearInterval(fallbackTimer)
      if (hintTimer) clearTimeout(hintTimer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [orderId, accessKey, phone, enabled])

  return { connected, liveHint }
}
