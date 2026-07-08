'use client'

import { Lock, Loader2 } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import { formatBDT } from '@/lib/utils/currency'
import { checkoutMotionTransition, checkoutTapSpring } from '@/lib/checkout/checkout-motion'

interface CheckoutMobileBarProps {
  itemCount: number
  totalBdt: number
  submitting: boolean
  disabled?: boolean
}

export function CheckoutMobileBar({
  itemCount,
  totalBdt,
  submitting,
  disabled = false,
}: CheckoutMobileBarProps) {
  const reduced = useReducedMotion()
  const pressMotion = reduced || submitting || disabled ? {} : { whileTap: checkoutTapSpring }

  return (
    <div className="checkout-mobile-bar lg:hidden">
      <div>
        <p className="checkout-mobile-bar__label">
          Total · {itemCount} {itemCount === 1 ? 'item' : 'items'}
        </p>
        <p className="checkout-mobile-bar__price">{formatBDT(totalBdt)}</p>
      </div>
      <motion.button
        type="submit"
        form="checkout-main-form"
        disabled={submitting || disabled}
        className="checkout-btn checkout-btn--primary"
        {...pressMotion}
        transition={checkoutMotionTransition(reduced, 0.18)}
      >
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.2} />
            Placing…
          </>
        ) : (
          <>
            <Lock className="h-4 w-4" />
            Place order
          </>
        )}
      </motion.button>
    </div>
  )
}
