'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import {
  canUseWebGL,
  earthIntersectionRootMargin,
  isNearViewport,
  prefersReducedMotion,
} from '@/lib/earth/globe-performance'
import { preloadFooterEarthAssets } from '@/lib/earth/textures'
import { importWithChunkRetry } from '@/lib/loadable-retry'

const EarthGlobe = dynamic(
  importWithChunkRetry(() =>
    import('@/components/earth/EarthGlobe').then((m) => m.EarthGlobe),
  ),
  { ssr: false },
)

type EarthMode = 'idle' | 'webgl' | 'fallback'

function StoryEarthPlaceholder({ flow = false }: { flow?: boolean }) {
  if (flow) {
    return (
      <div className="story-earth-panel__placeholder story-earth-panel__placeholder--flow" aria-hidden>
        <div className="story-earth-panel__placeholder-bg" />
        <div className="story-earth-panel__globe">
          <div className="story-earth-panel__globe-map" />
          <div className="story-earth-panel__globe-shade" />
          <div className="story-earth-panel__globe-highlight" />
          <div className="story-earth-panel__globe-atmo" />
        </div>
        <div className="story-earth-panel__placeholder-glow" />
      </div>
    )
  }

  return (
    <div className="story-earth-panel__placeholder" aria-hidden>
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 52% 48%, rgba(70, 110, 150, 0.35), rgba(5, 8, 12, 0.92) 68%)',
        }}
      />
    </div>
  )
}

const WEBGL_READY_TIMEOUT_MS = 12_000

export function StoryEarthGlobe() {
  const hostRef = useRef<HTMLDivElement>(null)
  const [mode, setMode] = useState<EarthMode>('idle')

  useEffect(() => {
    const host = hostRef.current
    if (!host || mode !== 'idle') return

    const activate = () => {
      if (!canUseWebGL() || prefersReducedMotion()) {
        setMode('fallback')
        return
      }
      void preloadFooterEarthAssets()
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

    const timer = window.setTimeout(() => {
      if (!host.querySelector('[data-earth-ready="true"]')) {
        setMode('fallback')
      }
    }, WEBGL_READY_TIMEOUT_MS)

    return () => window.clearTimeout(timer)
  }, [mode])

  return (
    <div ref={hostRef} className="absolute inset-0">
      {mode !== 'webgl' ? <StoryEarthPlaceholder flow={mode === 'fallback'} /> : null}
      {mode === 'webgl' ? (
        <EarthGlobe
          variant="story"
          className="absolute inset-0 [&>canvas]:!h-full [&>canvas]:!w-full"
          onUnavailable={() => setMode('fallback')}
        />
      ) : null}
    </div>
  )
}
