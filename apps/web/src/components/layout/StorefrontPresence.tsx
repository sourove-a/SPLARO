'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

const STORAGE_KEY = 'splaro_visitor_id'
const HEARTBEAT_MS = 10_000

const SKIP_PREFIXES = ['/maintenance', '/login', '/signup', '/forgot-password', '/reset-password', '/verify-email']

function readVisitorId(): string {
  if (typeof window === 'undefined') return ''
  try {
    const existing = window.localStorage.getItem(STORAGE_KEY)
    if (existing && existing.length <= 128) return existing
    const next =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `v-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    window.localStorage.setItem(STORAGE_KEY, next)
    return next
  } catch {
    return `v-${Date.now()}`
  }
}

function shouldSkip(pathname: string): boolean {
  return SKIP_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

/** Keeps storefront visitors in the admin "online now" header count. */
export function StorefrontPresence() {
  const pathname = usePathname() ?? '/'

  useEffect(() => {
    if (shouldSkip(pathname)) return

    const visitorId = readVisitorId()
    if (!visitorId) return

    const ping = () => {
      if (document.visibilityState !== 'visible') return
      void fetch('/api/presence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visitorId }),
        keepalive: true,
      }).catch(() => {
        /* best-effort — admin shows 0 when no heartbeats arrive */
      })
    }

    ping()
    const id = window.setInterval(ping, HEARTBEAT_MS)
    document.addEventListener('visibilitychange', ping)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', ping)
    }
  }, [pathname])

  return null
}
