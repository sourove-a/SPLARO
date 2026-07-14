'use client'

import { Suspense } from 'react'

import { EarthDisc } from '@/components/footer/earth-live/EarthDisc'

type FooterEarthSceneProps = {
  active: boolean
  reducedMotion: boolean
}

/** Canvas `orthographic` handles pixel-sized bounds — no extra camera override. */
export function FooterEarthScene({ active, reducedMotion }: FooterEarthSceneProps) {
  return (
    <Suspense fallback={null}>
      <EarthDisc active={active} reducedMotion={reducedMotion} />
    </Suspense>
  )
}
