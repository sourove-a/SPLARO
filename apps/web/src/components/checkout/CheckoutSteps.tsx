import { Check } from 'lucide-react'
import type { CheckoutStepStatus } from '@/lib/checkout/checkout-validation'

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
  return (
    <div className="checkout-steps checkout-glass-panel" aria-label="Checkout progress">
      <div className="checkout-steps__track" aria-hidden>
        <span
          className="checkout-steps__progress"
          style={{ width: `${Math.max(0, Math.min(100, progressPercent))}%` }}
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
              {status === 'complete' ? (
                <Check className="h-3 w-3" strokeWidth={2.8} />
              ) : (
                index + 1
              )}
            </span>
            <span className="checkout-step__label">{step}</span>
          </div>
        )
      })}
    </div>
  )
}
