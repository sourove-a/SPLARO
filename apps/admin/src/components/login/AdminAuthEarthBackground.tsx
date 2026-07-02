'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { preloadFooterEarthAssets } from '@/lib/earth/textures'

const EarthGlobe = dynamic(
  () => import('@/components/earth/EarthGlobe').then((m) => m.EarthGlobe),
  { ssr: false },
)

/** Real rotating Earth — same WebGL globe as storefront customer login. */
export function AdminAuthEarthBackground() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    void preloadFooterEarthAssets()
    const timer = window.setTimeout(() => setShow(true), 120)
    return () => window.clearTimeout(timer)
  }, [])

  return (
    <div className="admin-auth-shell__earth" aria-hidden>
      <div className="admin-auth-shell__earth-frame">
        <div className="admin-auth-shell__earth-stars admin-auth-shell__earth-stars--twinkle" aria-hidden />
        {show ? (
          <EarthGlobe
            variant="footer"
            className="admin-auth-shell__earth-canvas [&>canvas]:!h-full [&>canvas]:!w-full"
          />
        ) : null}
        <div className="admin-auth-shell__earth-glass" aria-hidden />
        <div className="admin-auth-shell__earth-vignette" aria-hidden />
      </div>
    </div>
  )
}
