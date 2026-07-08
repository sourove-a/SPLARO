import type { ReactNode } from 'react'

interface CheckoutFieldProps {
  label: string
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
  children: ReactNode
  full?: boolean
  hint?: string
  error?: string
  clientReady?: boolean
  filled?: boolean
  fieldId?: string
}

export function CheckoutField({
  label,
  icon: Icon,
  children,
  full,
  hint,
  error,
  clientReady = true,
  filled = false,
  fieldId,
}: CheckoutFieldProps) {
  return (
    <label
      className={`checkout-field checkout-field--icon ${full ? 'checkout-field--full' : ''} ${filled ? 'checkout-field--filled' : ''} ${error ? 'checkout-field--error' : ''}`}
      {...(fieldId ? { htmlFor: fieldId } : {})}
    >
      <span className="checkout-field__label">{label}</span>
      <div className="checkout-input-wrap" suppressHydrationWarning>
        {clientReady ? children : <div className="checkout-input" aria-hidden />}
        <span className="checkout-input-chip" aria-hidden>
          <Icon className="h-4 w-4" strokeWidth={2.1} />
        </span>
      </div>
      {error ? (
        <span className="checkout-field__error" role="alert">
          {error}
        </span>
      ) : hint ? (
        <span className="checkout-field__hint">{hint}</span>
      ) : null}
    </label>
  )
}
