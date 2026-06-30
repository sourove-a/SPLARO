'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type ApiPulse = 'checking' | 'online' | 'offline'

export function AdminApiStatus() {
  const [ready, setReady] = useState(false)
  const [pulse, setPulse] = useState<ApiPulse>('checking')
  const [latency, setLatency] = useState<number | null>(null)

  useEffect(() => {
    setReady(true)
    let cancelled = false
    let fails = 0

    const ping = async () => {
      try {
        const res = await fetch('/api/ping', { cache: 'no-store', signal: AbortSignal.timeout(5000) })
        const data = (await res.json()) as { online?: boolean; latencyMs?: number | null }
        if (cancelled) return
        if (data.online) {
          fails = 0
          setPulse('online')
          setLatency(typeof data.latencyMs === 'number' ? data.latencyMs : null)
        } else {
          fails += 1
          setPulse(fails >= 2 ? 'offline' : 'checking')
          setLatency(null)
        }
      } catch {
        if (cancelled) return
        fails += 1
        setPulse(fails >= 2 ? 'offline' : 'checking')
        setLatency(null)
      }
    }

    void ping()
    const id = window.setInterval(() => void ping(), 25_000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [])

  if (!ready) {
    return (
      <span className="hidden h-7 w-[4.5rem] rounded-full border border-transparent bg-transparent xl:inline-flex" aria-hidden />
    )
  }

  if (pulse === 'online') {
    return (
      <span
        className="hidden items-center gap-1.5 rounded-full border border-emerald-200/70 bg-emerald-50/80 px-2.5 py-1 text-[10px] font-bold text-emerald-800 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300 xl:inline-flex"
        title={latency !== null ? `API ${latency}ms` : 'API connected'}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
        API live
      </span>
    )
  }

  if (pulse === 'offline') {
    return (
      <Link
        href="/dashboard/api-health"
        className="hidden items-center gap-1.5 rounded-full border border-amber-200/80 bg-amber-50/90 px-2.5 py-1 text-[10px] font-bold text-amber-900 transition hover:bg-amber-100/90 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300 dark:hover:bg-amber-500/15 xl:inline-flex"
        title="Start API: pnpm dev:stack (or pnpm dev:api in another terminal)"
      >
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
        API offline
      </Link>
    )
  }

  return (
    <span className="hidden items-center gap-1.5 rounded-full border border-black/5 bg-white/50 px-2.5 py-1 text-[10px] font-semibold text-[#6B6B6B] dark:border-white/10 dark:bg-white/5 dark:text-white/55 xl:inline-flex">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--admin-text-muted)]" />
      Checking…
    </span>
  )
}
