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
  const topLead = Math.max(320, Math.round(window.innerHeight * 0.45))
  return `${topLead}px 0px 120px`
}

/**
 * Footer earth — mounts WebGL only when footer nears viewport (avoids ocean flash on refresh).
 */
export function LazyFooterEarthGlobe() {
  const hostRef = useRef<HTMLDivElement>(null)
  const [showGlobe, setShowGlobe] = useState(false)

  useEffect(() => {
    const host = hostRef.current
    if (!host || showGlobe) return

    const activate = () => {
      void preloadFooterEarthAssets()
      setShowGlobe(true)
    }
    const margin = buildRootMargin()

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) activate()
      },
      { rootMargin: margin, threshold: 0 },
    )
    observer.observe(host)

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
