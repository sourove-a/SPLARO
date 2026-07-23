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
    <motion.nav
      className="checkout-steps"
      aria-label="Checkout progress"
      style={{ ['--checkout-step-count' as string]: String(steps.length) }}
      {...checkoutChromeMotion(reduced)}
      transition={checkoutEnterTransition(reduced, 0.14)}
    >
      <div className="checkout-steps__track" aria-hidden>
        <motion.span
          className="checkout-steps__progress"
          initial={false}
          animate={{ width }}
          transition={
            reduced
              ? { duration: 0 }
              : { duration: 0.55, ease: [0.16, 1, 0.3, 1] }
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
            <span className="checkout-step__dot">
              <AnimatePresence mode="popLayout" initial={false}>
                {status === 'complete' ? (
                  <motion.span
                    key="check"
                    className="checkout-step__mark"
                    initial={reduced ? false : { opacity: 0, scale: 0.75 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: reduced ? 1 : 0, scale: reduced ? 1 : 0.75 }}
                    transition={{ duration: reduced ? 0 : 0.18 }}
                  >
                    <Check className="h-3 w-3" strokeWidth={2.6} />
                  </motion.span>
                ) : (
                  <motion.span
                    key="num"
                    className="checkout-step__mark"
                    initial={reduced ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: reduced ? 1 : 0 }}
                    transition={{ duration: reduced ? 0 : 0.16 }}
                  >
                    {index + 1}
                  </motion.span>
                )}
              </AnimatePresence>
            </span>
            <span className="checkout-step__label">{step}</span>
          </div>
        )
      })}
    </motion.nav>
  )
}
