import { PAYMENT_LOGO } from '@/lib/assets/brand'
import { DIGITAL_PAYMENT_DISCOUNT_RATE } from '@/lib/utils/currency'

export type PaymentMethod = 'Cash on Delivery' | 'bKash' | 'Nagad' | 'SSLCommerz'

function digitalDiscountHint(): string {
  if (DIGITAL_PAYMENT_DISCOUNT_RATE <= 0) return ''
  const pct = Math.round(DIGITAL_PAYMENT_DISCOUNT_RATE * 100)
  return ` · ${pct}% off at checkout`
}

export interface PaymentOption {
  id: PaymentMethod
  label: string
  hint: string
  logo?: string
  priority?: boolean
}

export interface PaymentVisibility {
  cod: boolean
  bkash: boolean
  nagad: boolean
  sslcommerz: boolean
}

export const DEFAULT_PAYMENT_VISIBILITY: PaymentVisibility = {
  cod: true,
  bkash: false,
  nagad: false,
  sslcommerz: false,
}

export function buildPaymentOptions(visibility: PaymentVisibility): PaymentOption[] {
  const options: PaymentOption[] = []

  if (visibility.cod) {
    options.push({
      id: 'Cash on Delivery',
      label: 'Cash on Delivery',
      hint: 'Pay when your parcel arrives',
      priority: true,
    })
  }

  if (visibility.bkash) {
    options.push({
      id: 'bKash',
      label: 'bKash',
      hint: `Pay securely via bKash${digitalDiscountHint()}`,
      logo: PAYMENT_LOGO.bkash,
    })
  }

  if (visibility.nagad) {
    options.push({
      id: 'Nagad',
      label: 'Nagad',
      hint: `Pay securely via Nagad${digitalDiscountHint()}`,
      logo: PAYMENT_LOGO.nagad,
    })
  }

  if (visibility.sslcommerz) {
    options.push({
      id: 'SSLCommerz',
      label: 'SSLCommerz',
      hint: `Visa, MasterCard, AMEX & more${digitalDiscountHint()}`,
      logo: PAYMENT_LOGO.sslcommerz,
    })
  }

  return options
}

export function isDigitalPayment(payment: PaymentMethod) {
  return payment !== 'Cash on Delivery'
}

export function isPaymentAvailable(payment: PaymentMethod, visibility: PaymentVisibility) {
  if (payment === 'Cash on Delivery') return visibility.cod
  if (payment === 'SSLCommerz') return visibility.sslcommerz
  if (payment === 'bKash') return visibility.bkash
  if (payment === 'Nagad') return visibility.nagad
  return false
}
