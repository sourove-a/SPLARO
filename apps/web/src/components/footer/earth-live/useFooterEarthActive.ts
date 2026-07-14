'use client'

import { useEffect, useRef, useState } from 'react'

import { isNearViewport } from '@/lib/earth/globe-performance'
import { useUiStore } from '@/store/uiStore'

/**
 * Pause earth video/WebGL when footer is off-screen OR a full-screen overlay
 * (Search / Cart / mobile menu) covers it — IntersectionObserver alone still
 * reports "visible" under an opaque modal and kept GPU spinning (Search stutter).
 */
export function useFooterEarthActive() {
  const ref = useRef<HTMLDivElement>(null)
  const [nearViewport, setNearViewport] = useState(true)
  const overlayOpen = useUiStore(
    (s) => s.isSearchOpen || s.isCartOpen || s.isMobileMenuOpen || s.scrollLockCount > 0,
  )

  useEffect(() => {
    const host = ref.current
    if (!host) return

    const sync = () => {
      setNearViewport(isNearViewport(host, 200))
    }

    sync()

    const observer = new IntersectionObserver(
      ([entry]) => {
        setNearViewport(Boolean(entry?.isIntersecting) || isNearViewport(host, 200))
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

  return { ref, active: nearViewport && !overlayOpen }
}
