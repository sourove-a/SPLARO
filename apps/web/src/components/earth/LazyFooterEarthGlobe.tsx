'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { preloadFooterEarthAssets } from '@/lib/earth/textures'
import { importWithChunkRetry } from '@/lib/loadable-retry'

const FooterEarthGlobe = dynamic(
  importWithChunkRetry(() =>
    import('@/components/earth/FooterEarthGlobe').then((m) => m.FooterEarthGlobe),
  ),
  { ssr: false },
)

function buildRootMargin() {
  const topLead = Math.max(800, Math.round(window.innerHeight * 1.5))
  return `${topLead}px 0px 400px`
}

function isCoarsePointer() {
  return window.matchMedia('(pointer: coarse)').matches
}

/**
 * Footer earth — preloads textures early; mounts WebGL when footer approaches viewport.
 * Coarse pointer: IntersectionObserver only (no timer auto-mount). Fine pointer: same IO path.
 */
export function LazyFooterEarthGlobe() {
  const hostRef = useRef<HTMLDivElement>(null)
  const [showGlobe, setShowGlobe] = useState(false)

  useEffect(() => {
    void preloadFooterEarthAssets()
  }, [])

  useEffect(() => {
    const host = hostRef.current
    if (!host || showGlobe) return

    const activate = () => setShowGlobe(true)
    const margin = buildRootMargin()

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) activate()
      },
      { rootMargin: margin, threshold: 0 },
    )
    observer.observe(host)

    // Desktop fine pointer: if footer is already in view on load, mount immediately.
    if (!isCoarsePointer()) {
      const rect = host.getBoundingClientRect()
      const inRange = rect.top < window.innerHeight + 400
      if (inRange) activate()
    }

    return () => observer.disconnect()
  }, [showGlobe])

  return (
    <div ref={hostRef} className="site-footer__earth" aria-hidden>
      <div className="site-footer__earth-glass" aria-hidden />
      <div className="site-footer__earth-stars site-footer__earth-stars--twinkle" aria-hidden />
      {showGlobe ? <FooterEarthGlobe /> : null}
    </div>
  )
}
