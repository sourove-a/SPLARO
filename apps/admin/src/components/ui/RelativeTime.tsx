'use client'

import { useEffect, useState } from 'react'
import { formatRelativeTime } from '@/lib/api/orders'

/** Client-only relative time to avoid hydration mismatch from Date.now(). */
export function RelativeTime({ iso, className }: { iso: string; className?: string }) {
  const [label, setLabel] = useState<string>('—')

  useEffect(() => {
    setLabel(formatRelativeTime(iso))
    const id = window.setInterval(() => setLabel(formatRelativeTime(iso)), 60_000)
    return () => window.clearInterval(id)
  }, [iso])

  return <span className={className} suppressHydrationWarning>{label}</span>
}
