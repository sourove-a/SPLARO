'use client'

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
      className={`checkout-field ${full ? 'checkout-field--full' : ''} ${filled ? 'checkout-field--filled' : ''} ${error ? 'checkout-field--error' : ''}`}
      {...(fieldId ? { htmlFor: fieldId } : {})}
    >
      <span className="checkout-field__label">
        <Icon className="checkout-field__label-icon" strokeWidth={2} aria-hidden />
        {label}
      </span>
      <div className="checkout-input-wrap" suppressHydrationWarning>
        {clientReady ? children : <div className="checkout-input" aria-hidden />}
      </div>
      {error ? (
        <span
          className="checkout-field__error"
          id={fieldId ? `${fieldId}-error` : undefined}
          role="alert"
        >
          {error}
        </span>
      ) : hint ? (
        <span className="checkout-field__hint" id={fieldId ? `${fieldId}-hint` : undefined}>
          {hint}
        </span>
      ) : null}
    </label>
  )
}
