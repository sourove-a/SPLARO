'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import {
  earthIntersectionRootMargin,
  isNearViewport,
  shouldUseWebGLEarth,
} from '@/lib/earth/globe-performance'
import { preloadEarthTextures } from '@/lib/earth/textures'
import { importWithChunkRetry } from '@/lib/loadable-retry'

const EarthGlobe = dynamic(
  importWithChunkRetry(() =>
    import('@/components/earth/EarthGlobe').then((m) => m.EarthGlobe),
  ),
  { ssr: false },
)

type EarthMode = 'css' | 'webgl'

function StoryEarthPlaceholder({ flow = false, hidden = false }: { flow?: boolean; hidden?: boolean }) {
  return (
    <div
      className={`story-earth-panel__placeholder story-earth-panel__placeholder--flow${hidden ? ' story-earth-panel__placeholder--hidden' : ''}`}
      aria-hidden
    >
      <div className="story-earth-panel__placeholder-bg" />
      <div className="story-earth-panel__globe">
        <div
          className={`story-earth-panel__globe-map${flow ? '' : ' story-earth-panel__globe-map--static'}`}
        />
        <div className="story-earth-panel__globe-shade" />
        <div className="story-earth-panel__globe-highlight" />
        <div className="story-earth-panel__globe-atmo" />
      </div>
      <div className="story-earth-panel__placeholder-glow" />
    </div>
  )
}

export function StoryEarthGlobe() {
  const hostRef = useRef<HTMLDivElement>(null)
  const [mode, setMode] = useState<EarthMode>('css')
  const [webglReady, setWebglReady] = useState(false)

  useEffect(() => {
    const host = hostRef.current
    if (!host || mode !== 'css') return

    const activate = () => {
      if (!shouldUseWebGLEarth({ decorative: true })) return
      void preloadEarthTextures()
      setMode('webgl')
    }

    if (isNearViewport(host, 240)) {
      activate()
      return
    }

    const margin = earthIntersectionRootMargin(true)
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) activate()
      },
      { rootMargin: margin, threshold: 0.01 },
    )
    observer.observe(host)

    const onScroll = () => {
      if (isNearViewport(host, 240)) activate()
    }
    window.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      observer.disconnect()
      window.removeEventListener('scroll', onScroll)
    }
  }, [mode])

  useEffect(() => {
    if (mode !== 'webgl') return
    const host = hostRef.current
    if (!host) return

    const markReady = () => {
      if (host.querySelector('[data-earth-ready="true"]')) setWebglReady(true)
    }

    markReady()
    const observer = new MutationObserver(markReady)
    observer.observe(host, {
      subtree: true,
      attributes: true,
      attributeFilter: ['data-earth-ready'],
    })

    return () => observer.disconnect()
  }, [mode])

  const showCss = mode === 'css' || !webglReady

  const handleUnavailable = useCallback(() => {
    setWebglReady(false)
    setMode('css')
  }, [])

  return (
    <div ref={hostRef} className="absolute inset-0">
      {showCss ? <StoryEarthPlaceholder flow hidden={webglReady} /> : null}
      {mode === 'webgl' ? (
        <EarthGlobe
          variant="story"
          ignoreReducedMotion
          className="absolute inset-0 [&>canvas]:!h-full [&>canvas]:!w-full"
          onUnavailable={handleUnavailable}
        />
      ) : null}
    </div>
  )
}
