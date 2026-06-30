import { Check } from 'lucide-react'

const DEFAULT_STEPS = ['Delivery', 'Payment', 'Confirm'] as const

interface CheckoutStepsProps {
  activeStep: number
  steps?: readonly string[]
}

export function CheckoutSteps({
  activeStep,
  steps = DEFAULT_STEPS,
}: CheckoutStepsProps) {
  return (
    <div className="checkout-steps checkout-glass-panel" aria-label="Checkout progress">
      {steps.map((step, index) => (
        <div
          key={step}
          className={`checkout-step ${index + 1 <= activeStep ? 'checkout-step--active' : ''} ${index + 1 < activeStep ? 'checkout-step--done' : ''}`}
        >
          <span className="checkout-step__dot">
            {index + 1 < activeStep ? (
              <Check className="h-3 w-3" strokeWidth={2.8} />
            ) : (
              index + 1
            )}
          </span>
          <span className="checkout-step__label">{step}</span>
        </div>
      ))}
    </div>
  )
}
