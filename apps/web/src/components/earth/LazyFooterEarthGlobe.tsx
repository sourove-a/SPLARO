'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { usePathname } from 'next/navigation'
import { earthIntersectionRootMargin, isNearViewport } from '@/lib/earth/globe-performance'
import { preloadFooterEarthAssets } from '@/lib/earth/textures'
import { importWithChunkRetry } from '@/lib/loadable-retry'

const FooterEarthGlobe = dynamic(
  importWithChunkRetry(() =>
    import('@/components/earth/FooterEarthGlobe').then((m) => m.FooterEarthGlobe),
  ),
  { ssr: false },
)

/**
 * Footer earth — mounts WebGL only when footer nears viewport.
 * Skipped on homepage — story earth already renders a globe in Our Story.
 */
export function LazyFooterEarthGlobe() {
  const pathname = usePathname()
  const isHomepage = pathname === '/'
  const hostRef = useRef<HTMLDivElement>(null)
  const [showGlobe, setShowGlobe] = useState(false)

  useEffect(() => {
    if (isHomepage) return
    const host = hostRef.current
    if (!host || showGlobe) return

    const activate = () => {
      void preloadFooterEarthAssets()
      setShowGlobe(true)
    }

    if (isNearViewport(host, 320)) {
      activate()
      return
    }

    const margin = earthIntersectionRootMargin()
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) activate()
      },
      { rootMargin: margin, threshold: 0.01 },
    )
    observer.observe(host)

    const onScroll = () => {
      if (isNearViewport(host, 320)) activate()
    }
    window.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      observer.disconnect()
      window.removeEventListener('scroll', onScroll)
    }
  }, [showGlobe, isHomepage])

  return (
    <div ref={hostRef} className="site-footer__earth" aria-hidden>
      <div className="site-footer__earth-glass" aria-hidden />
      <div className="site-footer__earth-stars site-footer__earth-stars--twinkle" aria-hidden />
      {!isHomepage && showGlobe ? <FooterEarthGlobe /> : null}
    </div>
  )
}
