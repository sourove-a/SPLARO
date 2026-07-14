'use client'

import { useEffect, useRef, useState } from 'react'

import { isNearViewport } from '@/lib/earth/globe-performance'

/**
 * Pause RAF when footer is off-screen — saves GPU while keeping composition intact.
 */
export function useFooterEarthActive() {
  const ref = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(true)

  useEffect(() => {
    const host = ref.current
    if (!host) return

    const sync = () => {
      setActive(isNearViewport(host, 200))
    }

    sync()

    const observer = new IntersectionObserver(
      ([entry]) => {
        setActive(Boolean(entry?.isIntersecting) || isNearViewport(host, 200))
      },
      { rootMargin: '120px 0px', threshold: 0.01 },
    )

    observer.observe(host)
    window.addEventListener('scroll', sync, { passive: true, capture: true })
    window.addEventListener('resize', sync, { passive: true })

    return () => {
      observer.disconnect()
      window.removeEventListener('scroll', sync, { capture: true } as EventListenerOptions)
      window.removeEventListener('resize', sync)
    }
  }, [])

  return { ref, active }
}
