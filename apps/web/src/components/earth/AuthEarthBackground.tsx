'use client'

import { EarthBackdrop } from '@/components/footer/EarthBackdrop'
import { useMounted, useTouchUiViewport } from '@/lib/hooks/use-mobile-viewport'

const AUTH_EARTH_POSTER = '/videos/footer-globe-poster.jpg'

function AuthEarthStatic() {
  return (
    <div className="auth-shell__earth-static">
      <img
        className="auth-shell__earth-static__img"
        src={AUTH_EARTH_POSTER}
        alt=""
        width={1920}
        height={1080}
        loading="eager"
        decoding="async"
        fetchPriority="high"
        draggable={false}
      />
      <div className="auth-shell__earth-static__scrim" />
    </div>
  )
}

/**
 * Auth backdrop. Desktop fine-pointer only: cinematic globe video.
 * Phone/tablet/landscape (touch UI): static poster — 1080p video was starving taps.
 */
export function AuthEarthBackground() {
  const mounted = useMounted()
  const isTouchUi = useTouchUiViewport()
  // Default static until we know viewport — avoids phone video flash on hydrate.
  const useLiveVideo = mounted && !isTouchUi

  return (
    <div
      className="auth-shell__earth-backdrop"
      aria-hidden
      data-auth-earth={useLiveVideo ? 'live' : 'static'}
    >
      {useLiveVideo ? <EarthBackdrop /> : <AuthEarthStatic />}
    </div>
  )
}
