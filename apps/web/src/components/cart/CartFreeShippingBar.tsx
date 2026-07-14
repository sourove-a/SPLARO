'use client'

import { motion } from '@/lib/motion/react'
import { MotionSwapLabel } from '@/components/ui/MotionSwapLabel/MotionSwapLabel'
import { formatBDT } from '@/lib/utils/currency'

interface CartFreeShippingBarProps {
  subtotal: number
  threshold: number
}

export function CartFreeShippingBar({ subtotal, threshold }: CartFreeShippingBarProps) {
  const remaining = Math.max(0, threshold - subtotal)
  const progress = Math.min(100, (subtotal / threshold) * 100)
  const unlocked = remaining <= 0

  return (
    <div className="border-b border-black/5 bg-white/55 px-6 py-3 backdrop-blur-2xl">
      <div className="mb-2 flex justify-between text-[0.625rem] uppercase tracking-[0.1em] text-luxury-gray">
        <MotionSwapLabel id={unlocked ? 'unlocked' : 'remaining'}>
          {unlocked ? 'Free shipping unlocked' : `Add ${formatBDT(remaining)} for free delivery`}
        </MotionSwapLabel>
        <span>{formatBDT(threshold)}</span>
      </div>
      <div className="h-0.5 overflow-hidden rounded-full bg-ivory-300">
        <motion.div
          className="h-full bg-gold"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        />
      </div>
    </div>
  )
}
