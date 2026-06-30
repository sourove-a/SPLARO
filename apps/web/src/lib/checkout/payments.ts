import { PAYMENT_LOGO } from '@/lib/assets/brand'

export type PaymentMethod = 'Cash on Delivery' | 'bKash' | 'Nagad' | 'SSLCommerz'

export interface PaymentOption {
  id: PaymentMethod
  label: string
  hint: string
  logo?: string
  priority?: boolean
}

export interface PaymentVisibility {
  bkash: boolean
  nagad: boolean
}

export function buildPaymentOptions(visibility: PaymentVisibility): PaymentOption[] {
  const options: PaymentOption[] = [
    {
      id: 'Cash on Delivery',
      label: 'Cash on Delivery',
      hint: 'Pay when your parcel arrives',
      priority: true,
    },
  ]

  if (visibility.bkash) {
    options.push({
      id: 'bKash',
      label: 'bKash',
      hint: 'Pay securely via bKash · 5% discount',
      logo: PAYMENT_LOGO.bkash,
    })
  }

  if (visibility.nagad) {
    options.push({
      id: 'Nagad',
      label: 'Nagad',
      hint: 'Pay securely via Nagad · 5% discount',
      logo: PAYMENT_LOGO.nagad,
    })
  }

  options.push({
    id: 'SSLCommerz',
    label: 'SSLCommerz',
    hint: 'Visa, MasterCard, AMEX & more · 5% discount',
    logo: PAYMENT_LOGO.sslcommerz,
  })

  return options
}

export function isDigitalPayment(payment: PaymentMethod) {
  return payment !== 'Cash on Delivery'
}

export function isPaymentAvailable(payment: PaymentMethod, visibility: PaymentVisibility) {
  if (payment === 'Cash on Delivery' || payment === 'SSLCommerz') return true
  if (payment === 'bKash') return visibility.bkash
  if (payment === 'Nagad') return visibility.nagad
  return false
}
