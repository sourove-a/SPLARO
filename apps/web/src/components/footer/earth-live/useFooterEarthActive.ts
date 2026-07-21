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
  const [nearViewport, setNearViewport] = useState(false)
  const overlayOpen = useUiStore(
    (s) => s.isSearchOpen || s.isCartOpen || s.isMobileMenuOpen || s.scrollLockCount > 0,
  )

  useEffect(() => {
    const host = ref.current
    if (!host) return

    const sync = () => {
      const next = isNearViewport(host, 200)
      setNearViewport((prev) => (prev === next ? prev : next))
    }

    sync()

    const observer = new IntersectionObserver(
      ([entry]) => {
        const next = Boolean(entry?.isIntersecting) || isNearViewport(host, 200)
        setNearViewport((prev) => (prev === next ? prev : next))
      },
      { rootMargin: '120px 0px', threshold: 0.01 },
    )

    observer.observe(host)

    let raf = 0
    const onScroll = () => {
      if (raf !== 0) return
      raf = window.requestAnimationFrame(() => {
        raf = 0
        sync()
      })
    }

    window.addEventListener('scroll', onScroll, { passive: true, capture: true })
    window.addEventListener('resize', onScroll, { passive: true })

    return () => {
      observer.disconnect()
      if (raf !== 0) window.cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onScroll, { capture: true } as EventListenerOptions)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  return { ref, active: nearViewport && !overlayOpen }
}
