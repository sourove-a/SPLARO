'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { isMobileViewport } from '@/lib/hooks/use-mobile-viewport'
import { cn } from '@/lib/utils/cn'

interface DeferUntilVisibleProps {
  children: ReactNode
  /** Reserved height before content mounts — avoids layout shift. */
  minHeight?: number
  className?: string
  /** When true, mount immediately (e.g. desktop). */
  eager?: boolean
}

/**
 * Mount children only when near the viewport — keeps below-fold JS/images off the critical path on mobile.
 */
export function DeferUntilVisible({
  children,
  minHeight = 480,
  className,
  eager = false,
}: DeferUntilVisibleProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(eager)

  useEffect(() => {
    if (eager || visible) return
    const host = hostRef.current
    if (!host) return

    const margin = isMobileViewport() ? '64px 0px' : '280px 0px'
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: margin, threshold: 0 },
    )
    observer.observe(host)
    return () => observer.disconnect()
  }, [eager, visible])

  return (
    <div
      ref={hostRef}
      className={cn(className)}
      style={visible ? undefined : { minHeight }}
      aria-busy={!visible}
    >
      {visible ? children : null}
    </div>
  )
}
