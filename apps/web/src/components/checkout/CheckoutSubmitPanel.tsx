'use client'

import { AlertCircle, Lock, Loader2 } from 'lucide-react'
import { motion, useReducedMotion } from '@/lib/motion/react'
import { formatBDT } from '@/lib/utils/currency'
import { checkoutMotionTransition, checkoutTapSpring } from '@/lib/checkout/checkout-motion'

interface CheckoutSubmitPanelProps {
  totalBdt: number
  submitting: boolean
  disabled: boolean
  error?: string
  onSubmitIntent?: () => void
}

export function CheckoutSubmitPanel({
  totalBdt,
  submitting,
  disabled,
  error,
  onSubmitIntent,
}: CheckoutSubmitPanelProps) {
  const reduced = useReducedMotion()
  const pressMotion = reduced || submitting || disabled ? {} : { whileTap: checkoutTapSpring }

  return (
    <div className="checkout-submit-panel">
      {error ? (
        <div className="checkout-error-banner" role="alert" aria-live="assertive">
          <AlertCircle className="checkout-error-banner__icon h-4 w-4" strokeWidth={2.2} />
          <p>{error}</p>
        </div>
      ) : null}

      <motion.button
        type="submit"
        disabled={disabled || submitting}
        className="checkout-btn checkout-btn--primary checkout-btn--full checkout-desktop-submit"
        onClick={onSubmitIntent}
        {...pressMotion}
        transition={checkoutMotionTransition(reduced, 0.18)}
      >
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.2} />
            Placing order…
          </>
        ) : (
          <>
            <Lock className="h-4 w-4" />
            {`Place order · ${formatBDT(totalBdt)}`}
          </>
        )}
      </motion.button>
    </div>
  )
}
