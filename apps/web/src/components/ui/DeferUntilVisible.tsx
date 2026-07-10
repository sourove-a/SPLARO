'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useMobileViewport, useMounted } from '@/lib/hooks/use-mobile-viewport'
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
 * Uses `mounted && isMobile` so hydration never mounts everything early on phones.
 */
export function DeferUntilVisible({
  children,
  minHeight = 480,
  className,
  deferOnMobile = true,
}: DeferUntilVisibleProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const mounted = useMounted()
  const isMobile = useMobileViewport()
  const [visible, setVisible] = useState(!deferOnMobile)

  useEffect(() => {
    if (!mounted) return

    if (!deferOnMobile || !isMobile) {
      setVisible(true)
      return
    }

    const host = hostRef.current
    if (!host) return

    const reveal = () => {
      setVisible(true)
      observer.disconnect()
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) reveal()
      },
      { rootMargin: '96px 0px', threshold: 0.01 },
    )
    observer.observe(host)

    const rect = host.getBoundingClientRect()
    if (rect.top <= window.innerHeight + 96) reveal()

    return () => observer.disconnect()
  }, [deferOnMobile, isMobile, mounted])

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
