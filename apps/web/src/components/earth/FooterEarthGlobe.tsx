'use client'

import { EarthGlobe } from '@/components/earth/EarthGlobe'

/** WebGL canvas for the footer earth — glass/stars live in LazyFooterEarthGlobe. */
export function FooterEarthGlobe({
  onUnavailable,
}: {
  onUnavailable?: () => void
}) {
  return (
    <EarthGlobe
      variant="footer"
      ignoreReducedMotion
      className="site-footer__earth-canvas [&>canvas]:!h-full [&>canvas]:!w-full"
      {...(onUnavailable ? { onUnavailable } : {})}
    />
  )
}
