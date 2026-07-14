'use client'

import { useEffect, useState, type ReactNode } from 'react'

interface DeferHeavyHydrationProps {
  children: ReactNode
  /** Max wait before forcing children on screen (ms). */
  timeoutMs?: number
}

/**
 * Paint above-the-fold first on hard reload — defer heavy client trees
 * until idle / next frame so wheel scroll stays responsive during hydrate.
 */
export function DeferHeavyHydration({ children, timeoutMs = 96 }: DeferHeavyHydrationProps) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    const done = () => {
      if (!cancelled) setReady(true)
    }

    if ('requestIdleCallback' in window) {
      const id = requestIdleCallback(done, { timeout: timeoutMs })
      return () => {
        cancelled = true
        cancelIdleCallback(id)
      }
    } else {
      const id = requestAnimationFrame(() => {
        requestAnimationFrame(done)
      })
      return () => {
        cancelled = true
        cancelAnimationFrame(id)
      }
    }
  }, [timeoutMs])

  if (ready) return <>{children}</>
  return null
}
