'use client'

import { ScrollReveal } from '@/components/motion/ScrollReveal'
import { SocialReelsPanel } from './SocialReelsPanel'

export function InstagramSection() {
  return (
    <section className="reels-section" aria-labelledby="reels-heading">
      <ScrollReveal variant="fadeUp" margin="-60px 0px -60px 0px">
        <SocialReelsPanel />
      </ScrollReveal>
    </section>
  )
}
