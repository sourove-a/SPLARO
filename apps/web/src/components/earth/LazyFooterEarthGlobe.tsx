'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import {
  computeFooterEarthLayout,
  footerEarthLayoutToCssVars,
} from '@/lib/earth/footer-framing'
import {
  earthIntersectionRootMargin,
  FOOTER_EARTH_MAP_X_PERCENT,
  isNearViewport,
  scheduleEarthWebGLActivation,
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

function applyFooterEarthCssVars(host: HTMLElement) {
  const { width, height } = host.getBoundingClientRect()
  if (width < 1 || height < 1) return
  const vars = footerEarthLayoutToCssVars(computeFooterEarthLayout(width, height))
  for (const [key, value] of Object.entries(vars)) {
    host.style.setProperty(key, value)
  }
}

/**
 * Footer — wide horizon earth. CSS map hidden while WebGL loads to avoid reload flash.
 */
export function LazyFooterEarthGlobe() {
  const hostRef = useRef<HTMLDivElement>(null)
  const [showGlobe, setShowGlobe] = useState(false)
  const [webglReady, setWebglReady] = useState(false)
  const [webglFailed, setWebglFailed] = useState(false)
  const [webglCapable, setWebglCapable] = useState<boolean | null>(null)
  const [active, setActive] = useState(true)

  useLayoutEffect(() => {
    setWebglCapable(shouldUseWebGLEarth({ decorative: true }))
    const host = hostRef.current
    if (host) applyFooterEarthCssVars(host)
  }, [])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const observer = new ResizeObserver(() => applyFooterEarthCssVars(host))
    observer.observe(host)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    for (const url of [
      '/images/earth/earth-day.webp',
      '/images/earth/earth-night.webp',
      '/images/earth/earth-clouds.webp',
    ]) {
      const img = new Image()
      img.src = url
    }
  }, [])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const observer = new IntersectionObserver(
      ([entry]) => setActive(Boolean(entry?.isIntersecting) || isNearViewport(host, 280)),
      { rootMargin: '160px 0px', threshold: 0.01 },
    )
    observer.observe(host)

    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (webglCapable === false) return

    const host = hostRef.current
    if (!host || showGlobe || webglFailed) return

    let activated = false
    let cancelScheduled: (() => void) | undefined

    const activate = () => {
      if (activated || !shouldUseWebGLEarth({ decorative: true })) return
      activated = true
      void preloadFooterEarthAssets()
      void import('@/components/earth/FooterEarthGlobe')
      setShowGlobe(true)
    }

    const scheduleActivate = () => {
      cancelScheduled?.()
      cancelScheduled = scheduleEarthWebGLActivation(activate)
    }

    if (isNearViewport(host, 640)) {
      scheduleActivate()
    } else {
      const margin = earthIntersectionRootMargin()
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry?.isIntersecting) activate()
        },
        { rootMargin: margin, threshold: 0.01 },
      )
      observer.observe(host)

      const onScroll = () => {
        if (isNearViewport(host, 640)) activate()
      }
      window.addEventListener('scroll', onScroll, { passive: true, capture: true })
      window.addEventListener('touchmove', onScroll, { passive: true })
      window.addEventListener('wheel', onScroll, { passive: true })
      const pollId = window.setInterval(onScroll, 1200)

      return () => {
        cancelScheduled?.()
        observer.disconnect()
        window.removeEventListener('scroll', onScroll, { capture: true } as EventListenerOptions)
        window.removeEventListener('touchmove', onScroll)
        window.removeEventListener('wheel', onScroll)
        window.clearInterval(pollId)
      }
    }

    return () => {
      cancelScheduled?.()
    }
  }, [showGlobe, webglFailed, webglCapable])

  useEffect(() => {
    if (!showGlobe) return
    const host = hostRef.current
    if (!host) return

    const markReady = () => {
      if (host.querySelector('.site-footer__earth-canvas[data-earth-ready="true"]')) {
        setWebglReady(true)
      }
    }

    markReady()
    const observer = new MutationObserver(markReady)
    observer.observe(host, {
      subtree: true,
      attributes: true,
      attributeFilter: ['data-earth-ready'],
    })

    return () => observer.disconnect()
  }, [showGlobe])

  const handleUnavailable = useCallback(() => {
    setShowGlobe(false)
    setWebglReady(false)
    setWebglFailed(true)
  }, [])

  const useCssOnly = webglFailed || webglCapable === false
  const webglLoading = showGlobe && !webglReady && !useCssOnly

  return (
    <div
      ref={hostRef}
      className="site-footer__earth"
      data-earth-mode={useCssOnly ? 'css' : showGlobe ? 'webgl' : 'pending'}
      data-earth-fallback-map={useCssOnly || !webglReady ? 'show' : 'hide'}
      data-earth-active={active ? 'true' : 'false'}
      data-earth-loading={webglLoading ? 'true' : 'false'}
      aria-hidden
      style={{ ['--footer-earth-map-x' as string]: FOOTER_EARTH_MAP_X_PERCENT }}
    >
      <FooterEarthCssFallback flow layout="horizon" />
      <div className="site-footer__earth-glass" aria-hidden />
      <div className="site-footer__earth-stars site-footer__earth-stars--twinkle" aria-hidden />
      {showGlobe && !useCssOnly ? <FooterEarthGlobe onUnavailable={handleUnavailable} /> : null}
    </div>
  )
}
