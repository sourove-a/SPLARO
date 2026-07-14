'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { EarthGlobe } from '@/components/earth/EarthGlobe'
import { shouldUseWebGLEarth } from '@/lib/earth/globe-performance'
import { preloadEarthTextures } from '@/lib/earth/textures'

/** CSS-only fallback — shows instantly while WebGL boots or when WebGL is unavailable. */
function StoryEarthCssFallback({ flow = true }: { flow?: boolean }) {
  return (
    <div className="story-earth-panel__placeholder story-earth-panel__placeholder--flow" aria-hidden>
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
    const capable = shouldUseWebGLEarth({ decorative: true })
    setWebglCapable(capable)
    void preloadEarthTextures()
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

    return () => observer.disconnect()
  }, [webglCapable])

  const handleUnavailable = useCallback(() => {
    setWebglReady(false)
    setWebglCapable(false)
  }, [])

  const mountWebgl = webglCapable === true
  const showCssFallback = !mountWebgl || !webglReady

  return (
    <div
      ref={hostRef}
      className="absolute inset-0"
      data-earth-phase={
        webglCapable === false ? 'css' : webglReady ? 'ready' : mountWebgl ? 'loading' : 'pending'
      }
    >
      {showCssFallback ? <StoryEarthCssFallback flow /> : null}
      {mountWebgl ? (
        <EarthGlobe
          variant="story"
          ignoreReducedMotion
          className="story-earth-panel__canvas absolute inset-0 [&>canvas]:!h-full [&>canvas]:!w-full"
          onUnavailable={handleUnavailable}
        />
      ) : null}
    </div>
  )
}
