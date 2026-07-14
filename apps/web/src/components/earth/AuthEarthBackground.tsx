'use client'

import { EarthBackdrop } from '@/components/footer/EarthBackdrop'

/** Auth — same cinematic globe video as the footer, full-viewport backdrop layer. */
export function AuthEarthBackground() {
  return (
    <div className="auth-shell__earth-backdrop" aria-hidden>
      <EarthBackdrop />
    </div>
  )
}
