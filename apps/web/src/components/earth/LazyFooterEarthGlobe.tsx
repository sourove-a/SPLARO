'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import dynamic from 'next/dynamic'
import {
  earthIntersectionRootMargin,
  FOOTER_EARTH_MAP_X_PERCENT,
  isNearViewport,
  shouldUseWebGLEarth,
} from '@/lib/earth/globe-performance'
import { preloadFooterEarthAssets } from '@/lib/earth/textures'
import { importWithChunkRetry } from '@/lib/loadable-retry'
import { FooterEarthCssFallback } from '@/components/earth/FooterEarthCssFallback'

const FooterEarthGlobe = dynamic(
  importWithChunkRetry(() =>
    import('@/components/earth/FooterEarthGlobe').then((m) => m.FooterEarthGlobe),
  ),
  { ssr: false },
)

/**
 * Footer earth — premium WebGL when footer nears viewport.
 * CSS fallback only when WebGL is unavailable (Windows RDP / blocked GPU).
 */
export function LazyFooterEarthGlobe() {
  const pathname = usePathname()
  /** Homepage already runs story WebGL — footer stays CSS-only to avoid double Three.js load on refresh. */
  const cssOnly = pathname === '/'
  const hostRef = useRef<HTMLDivElement>(null)
  const [showGlobe, setShowGlobe] = useState(false)
  const [webglFailed, setWebglFailed] = useState(false)
  const [webglCapable, setWebglCapable] = useState<boolean | null>(null)

  useEffect(() => {
    if (cssOnly) {
      setWebglCapable(false)
      return
    }
    setWebglCapable(shouldUseWebGLEarth({ decorative: true }))
  }, [cssOnly])

  useEffect(() => {
    const host = hostRef.current
    if (!host || cssOnly || showGlobe || webglFailed || webglCapable === false) return

    let activated = false
    const activate = () => {
      if (activated || !shouldUseWebGLEarth({ decorative: true })) return
      activated = true
      void preloadFooterEarthAssets()
      setShowGlobe(true)
    }

    const boot = () => {
      if (isNearViewport(host, 320)) {
        activate()
        return undefined
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
    }

    let teardown: (() => void) | undefined
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        teardown = boot()
      })
    })

    return () => {
      cancelAnimationFrame(raf)
      teardown?.()
    }
  }, [cssOnly, showGlobe, webglFailed, webglCapable])

  const handleUnavailable = useCallback(() => {
    setShowGlobe(false)
    setWebglFailed(true)
  }, [])

  const showCssFallback = cssOnly || webglFailed || webglCapable === false

  return (
    <div
      ref={hostRef}
      className="site-footer__earth"
      aria-hidden
      style={{ ['--footer-earth-map-x' as string]: FOOTER_EARTH_MAP_X_PERCENT }}
    >
      {showCssFallback ? <FooterEarthCssFallback flow /> : null}
      <div className="site-footer__earth-glass" aria-hidden />
      <div className="site-footer__earth-stars site-footer__earth-stars--twinkle" aria-hidden />
      {showGlobe ? <FooterEarthGlobe onUnavailable={handleUnavailable} /> : null}
    </div>
  )
}
