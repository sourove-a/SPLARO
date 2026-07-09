'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useMobileViewport } from '@/lib/hooks/use-mobile-viewport'
import { cn } from '@/lib/utils/cn'

interface DeferUntilVisibleProps {
  children: ReactNode
  /** Reserved height before content mounts — avoids layout shift. */
  minHeight?: number
  className?: string
  /** When true, below-fold blocks wait for scroll on mobile only. */
  deferOnMobile?: boolean
}

/**
 * Mount children only when near the viewport on mobile — keeps below-fold JS/images off the critical path.
 * SSR/hydration always render the placeholder shell (visible=false) to avoid markup mismatches.
 */
export function DeferUntilVisible({
  children,
  minHeight = 480,
  className,
  deferOnMobile = true,
}: DeferUntilVisibleProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const isMobile = useMobileViewport()

  useEffect(() => {
    if (!deferOnMobile || !isMobile) {
      setVisible(true)
      return
    }

    const host = hostRef.current
    if (!host) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: '64px 0px', threshold: 0 },
    )
    observer.observe(host)
    return () => observer.disconnect()
  }, [deferOnMobile, isMobile])

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
