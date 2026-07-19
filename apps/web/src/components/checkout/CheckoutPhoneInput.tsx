'use client'

import {
  formatBdPhoneInput,
  getBdPhoneError,
  isValidBdMobile,
} from '@/lib/checkout/phone'

interface CheckoutPhoneInputProps {
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  invalid?: boolean
  clientReady?: boolean
  id?: string
  describedBy?: string
}

export function CheckoutPhoneInput({
  value,
  onChange,
  onBlur,
  invalid = false,
  clientReady = true,
  id,
  describedBy,
}: CheckoutPhoneInputProps) {
  if (!clientReady) {
    return <div className="checkout-input checkout-phone-input" aria-hidden />
  }

  return (
    <div className={`checkout-phone-input ${invalid ? 'checkout-phone-input--invalid' : ''}`}>
      <span className="checkout-phone-input__prefix" aria-hidden>
        +88
      </span>
      <input
        id={id}
        required
        type="tel"
        inputMode="numeric"
        value={value}
        onChange={(event) => onChange(formatBdPhoneInput(event.target.value))}
        onBlur={onBlur}
        className="checkout-phone-input__field"
        placeholder="01XXXXXXXXX"
        autoComplete="tel-national"
        maxLength={13}
        aria-label="Phone number"
        aria-invalid={invalid}
        aria-describedby={describedBy}
      />
    </div>
  )
}

export { getBdPhoneError, isValidBdMobile }
