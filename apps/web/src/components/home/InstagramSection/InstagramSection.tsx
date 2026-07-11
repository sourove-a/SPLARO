'use client'

import { motion } from 'framer-motion'
import { useMotionReady } from '@/hooks/useMotionReady'
import { REVEAL_ENTER } from '@/lib/motion/config'
import { SocialReelsPanel } from './SocialReelsPanel'

export function InstagramSection() {
  const { showMotion } = useMotionReady()

  const panel = <SocialReelsPanel />

  return (
    <section className="reels-section" aria-labelledby="reels-heading">
      {showMotion ? (
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={REVEAL_ENTER}
        >
          {panel}
        </motion.div>
      ) : (
        <div>{panel}</div>
      )}
    </section>
  )
}
