'use client'

import { motion } from 'framer-motion'
import { SocialReelsPanel } from './SocialReelsPanel'

export function InstagramSection() {
  return (
    <section className="reels-section" aria-labelledby="reels-heading">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      >
        <SocialReelsPanel />
      </motion.div>
    </section>
  )
}
