'use client'

import { AlertCircle, Lock, Loader2 } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from '@/lib/motion/react'
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
      <AnimatePresence initial={false}>
        {error ? (
          <motion.div
            key="checkout-error"
            className="checkout-error-banner"
            role="alert"
            aria-live="assertive"
            initial={reduced ? false : { opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: reduced ? 1 : 0, y: reduced ? 0 : -4 }}
            transition={{ duration: reduced ? 0 : 0.24, ease: [0.16, 1, 0.3, 1] }}
          >
            <AlertCircle className="checkout-error-banner__icon h-4 w-4" strokeWidth={2.2} />
            <p>{error}</p>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <motion.button
        type="submit"
        disabled={disabled || submitting}
        className="checkout-btn checkout-btn--primary checkout-btn--full checkout-desktop-submit"
        onClick={onSubmitIntent}
        {...pressMotion}
        transition={checkoutMotionTransition(reduced, 0.18)}
        animate={{ opacity: submitting && !reduced ? 0.94 : 1 }}
      >
        <AnimatePresence mode="wait" initial={false}>
          {submitting ? (
            <motion.span
              key="submitting"
              className="checkout-submit-panel__label"
              initial={reduced ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: reduced ? 1 : 0, y: reduced ? 0 : -6 }}
              transition={{ duration: reduced ? 0 : 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.2} />
              Placing order…
            </motion.span>
          ) : (
            <motion.span
              key="ready"
              className="checkout-submit-panel__label"
              initial={reduced ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: reduced ? 1 : 0, y: reduced ? 0 : -6 }}
              transition={{ duration: reduced ? 0 : 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              <Lock className="h-4 w-4" />
              {`Place order · ${formatBDT(totalBdt)}`}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  )
}
