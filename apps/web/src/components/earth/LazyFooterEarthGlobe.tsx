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

/**
 * Footer earth — preloads textures early; mounts WebGL when footer approaches viewport.
 * On reload-at-bottom: checks immediately if already in range and mounts without delay.
 */
export function LazyFooterEarthGlobe() {
  const hostRef = useRef<HTMLDivElement>(null)
  const [showGlobe, setShowGlobe] = useState(false)

  useEffect(() => {
    void preloadFooterEarthAssets()
  }, [])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const activate = () => setShowGlobe(true)

    const margin = buildRootMargin()

    let observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) activate()
      },
      { rootMargin: margin, threshold: 0 },
    )
    observer.observe(host)

    const onResize = () => {
      observer.disconnect()
      const newMargin = buildRootMargin()
      observer = new IntersectionObserver(
        ([entry]) => {
          if (entry?.isIntersecting) activate()
        },
        { rootMargin: newMargin, threshold: 0 },
      )
      observer.observe(host)
    }

    window.addEventListener('resize', onResize, { passive: true })

    return () => {
      window.removeEventListener('resize', onResize)
      observer.disconnect()
    }
  }, [])

  return (
    <div ref={hostRef} className="site-footer__earth" aria-hidden>
      <div className="site-footer__earth-glass" aria-hidden />
      <div className="site-footer__earth-stars site-footer__earth-stars--twinkle" aria-hidden />
      {showGlobe ? <FooterEarthGlobe /> : null}
    </div>
  )
}
