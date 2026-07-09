'use client'

import { EarthGlobe } from '@/components/earth/EarthGlobe'
import { useMobileViewport, useMounted } from '@/lib/hooks/use-mobile-viewport'

export function StoryEarthGlobe() {
  const isMobile = useMobileViewport()
  const mounted = useMounted()
  if (mounted && isMobile) return null

  return (
    <EarthGlobe
      variant="story"
      className="absolute inset-0 [&>canvas]:!h-full [&>canvas]:!w-full"
    />
  )
}
