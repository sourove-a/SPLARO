'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { preloadFooterEarthAssets } from '@/lib/earth/textures'

// Reuses the same EarthGlobe as the footer (variant unchanged) — footer is untouched.
const EarthGlobe = dynamic(
  () => import('@/components/earth/EarthGlobe').then((m) => m.EarthGlobe),
  { ssr: false },
)

/**
 * Floating earth behind the auth glass panel. Canvas is transparent, so the globe
 * appears to flow over the light premium shell — same rotation as the footer earth.
 */
export function AuthEarthBackground() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    void preloadFooterEarthAssets()
    // Defer WebGL mount past first paint so the form stays instant.
    const timer = window.setTimeout(() => setShow(true), 120)
    return () => window.clearTimeout(timer)
  }, [])

  return (
    <div className="auth-shell__earth" aria-hidden>
      <div className="auth-shell__earth-frame">
        <div className="auth-shell__earth-stars auth-shell__earth-stars--twinkle" aria-hidden />
        {show ? (
          <EarthGlobe
            variant="footer"
            className="auth-shell__earth-canvas [&>canvas]:!h-full [&>canvas]:!w-full"
          />
        ) : null}
        <div className="auth-shell__earth-glass" aria-hidden />
        <div className="auth-shell__earth-vignette" aria-hidden />
      </div>
    </div>
  )
}
