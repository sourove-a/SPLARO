'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { earthIntersectionRootMargin, isNearViewport } from '@/lib/earth/globe-performance'
import { preloadFooterEarthAssets } from '@/lib/earth/textures'
import { importWithChunkRetry } from '@/lib/loadable-retry'

const EarthGlobe = dynamic(
  importWithChunkRetry(() =>
    import('@/components/earth/EarthGlobe').then((m) => m.EarthGlobe),
  ),
  { ssr: false },
)

function StoryEarthPlaceholder() {
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

export function StoryEarthGlobe() {
  const hostRef = useRef<HTMLDivElement>(null)
  const [showGlobe, setShowGlobe] = useState(false)

  useEffect(() => {
    const host = hostRef.current
    if (!host || showGlobe) return

    const activate = () => {
      void preloadFooterEarthAssets()
      setShowGlobe(true)
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
  }, [showGlobe])

  return (
    <div ref={hostRef} className="absolute inset-0">
      {!showGlobe ? <StoryEarthPlaceholder /> : null}
      {showGlobe ? (
        <EarthGlobe
          variant="story"
          className="absolute inset-0 [&>canvas]:!h-full [&>canvas]:!w-full"
        />
      ) : null}
    </div>
  )
}
