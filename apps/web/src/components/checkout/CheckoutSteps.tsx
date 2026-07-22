'use client'

import { Check } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from '@/lib/motion/react'
import type { CheckoutStepStatus } from '@/lib/checkout/checkout-validation'
import { checkoutChromeMotion, checkoutEnterTransition } from '@/lib/checkout/checkout-motion'

interface CheckoutStepsProps {
  stepStatuses: CheckoutStepStatus[]
  progressPercent: number
  steps: readonly string[]
}

export function CheckoutSteps({
  stepStatuses,
  progressPercent,
  steps,
}: CheckoutStepsProps) {
  const reduced = useReducedMotion()
  const width = `${Math.max(0, Math.min(100, progressPercent))}%`

  return (
    <motion.div
      className="checkout-steps checkout-glass-panel"
      aria-label="Checkout progress"
      {...checkoutChromeMotion(reduced)}
      transition={checkoutEnterTransition(reduced, 0.1)}
    >
      <div className="checkout-steps__track" aria-hidden>
        <motion.span
          className="checkout-steps__progress"
          initial={false}
          animate={{ width }}
          transition={
            reduced
              ? { duration: 0 }
              : { duration: 0.7, ease: [0.16, 1, 0.3, 1] }
          }
        />
      </div>
      {steps.map((step, index) => {
        const status = stepStatuses[index] ?? 'pending'
        return (
          <div
            key={step}
            className={`checkout-step checkout-step--${status}`}
            aria-current={status === 'active' ? 'step' : undefined}
          >
            <motion.span
              className="checkout-step__dot"
              initial={false}
              animate={{ scale: !reduced && status === 'active' ? 1.06 : 1 }}
              transition={
                reduced
                  ? { duration: 0 }
                  : { duration: 0.32, ease: [0.16, 1, 0.3, 1] }
              }
            >
              <AnimatePresence mode="popLayout" initial={false}>
                {status === 'complete' ? (
                  <motion.span
                    key="check"
                    className="checkout-step__mark"
                    initial={reduced ? false : { opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: reduced ? 1 : 0, scale: reduced ? 1 : 0.7 }}
                    transition={{ duration: reduced ? 0 : 0.22, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <Check className="h-3 w-3" strokeWidth={2.8} />
                  </motion.span>
                ) : (
                  <motion.span
                    key="num"
                    className="checkout-step__mark"
                    initial={reduced ? false : { opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: reduced ? 1 : 0, y: reduced ? 0 : -4 }}
                    transition={{ duration: reduced ? 0 : 0.2, ease: [0.16, 1, 0.3, 1] }}
                  >
                    {index + 1}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.span>
            <span className="checkout-step__label">{step}</span>
          </div>
        )
      })}
    </motion.div>
  )
}
