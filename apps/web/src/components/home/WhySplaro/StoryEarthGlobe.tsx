'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { shouldUseWebGLEarth } from '@/lib/earth/globe-performance'
import { preloadEarthTextures } from '@/lib/earth/textures'

/** Lazy three.js — never ship EarthGlobe in the home critical chunk on touch. */
const EarthGlobe = dynamic(
  () => import('@/components/earth/EarthGlobe').then((m) => m.EarthGlobe),
  { ssr: false },
)

/** CSS-only globe — always under WebGL so soft-GL / failed canvas never leaves a black hole. */
function StoryEarthCssFallback({
  flow = true,
  dimmed = false,
}: {
  flow?: boolean
  dimmed?: boolean
}) {
  return (
    <div
      className={`story-earth-panel__placeholder story-earth-panel__placeholder--flow${
        dimmed ? ' story-earth-panel__placeholder--hidden' : ''
      }`}
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
  const [webglCapable, setWebglCapable] = useState<boolean | null>(null)
  const [webglReady, setWebglReady] = useState(false)

  useLayoutEffect(() => {
    // Touch/Windows/soft-GL → CSS map only (no three.js cost).
    const capable = shouldUseWebGLEarth({ decorative: true })
    setWebglCapable(capable)
    if (capable) void preloadEarthTextures()
  }, [])

  useEffect(() => {
    if (webglCapable !== true) return
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

    const failSafe = window.setTimeout(() => {
      if (!host.querySelector('[data-earth-ready="true"]')) {
        setWebglCapable(false)
        setWebglReady(false)
      }
    }, 8000)

    return () => {
      observer.disconnect()
      window.clearTimeout(failSafe)
    }
  }, [webglCapable])

  const handleUnavailable = useCallback(() => {
    setWebglReady(false)
    setWebglCapable(false)
  }, [])

  const mountWebgl = webglCapable === true

  return (
    <div
      ref={hostRef}
      className="absolute inset-0"
      data-earth-phase={
        webglCapable === false ? 'css' : webglReady ? 'ready' : mountWebgl ? 'loading' : 'pending'
      }
    >
      <StoryEarthCssFallback flow dimmed={mountWebgl && webglReady} />
      {mountWebgl ? (
        <EarthGlobe
          variant="story"
          ignoreReducedMotion
          className="story-earth-panel__canvas absolute inset-0 z-[1] [&>canvas]:!h-full [&>canvas]:!w-full"
          onUnavailable={handleUnavailable}
        />
      ) : null}
    </div>
  )
}
