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
    <div className="cart-ship-bar">
      <div className="cart-ship-bar__row">
        <MotionSwapLabel id={unlocked ? 'unlocked' : 'remaining'}>
          {unlocked ? 'Free shipping unlocked' : `Add ${formatBDT(remaining)} for free delivery`}
        </MotionSwapLabel>
        <span className="cart-ship-bar__threshold">{formatBDT(threshold)}</span>
      </div>
      <div className="cart-ship-bar__track">
        <motion.div
          className="cart-ship-bar__fill"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
        />
      </div>
    </div>
  )
}
