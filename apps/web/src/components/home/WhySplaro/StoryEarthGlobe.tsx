'use client'

import { EarthGlobe } from '@/components/earth/EarthGlobe'

export function StoryEarthGlobe() {
  return (
    <EarthGlobe
      variant="story"
      className="absolute inset-0 [&>canvas]:!h-full [&>canvas]:!w-full"
    />
  )
}
