import { isBdDistrict } from '@/lib/checkout/bd-districts'
import { formatBdPhoneInput } from '@/lib/checkout/phone'
import type { PaymentMethod } from '@/lib/checkout/payments'

export interface CheckoutCustomerDraft {
  name: string
  email: string
  phone: string
  address: string
  city: string
  payment: PaymentMethod
}

const DEFAULT_PAYMENT: PaymentMethod = 'Cash on Delivery'

/** SSR-safe defaults — never reads browser storage. */
export function getCheckoutFormDefaults(): CheckoutCustomerDraft {
  return {
    name: '',
    email: '',
    phone: '',
    address: '',
    city: 'Dhaka',
    payment: DEFAULT_PAYMENT,
  }
}

/** Load saved checkout fields from localStorage (client-only, call in useEffect). */
export function loadCheckoutCustomerDraft(): CheckoutCustomerDraft {
  const defaults = getCheckoutFormDefaults()

  try {
    const savedCustomer = window.localStorage.getItem('splaro-customer')
    if (savedCustomer) {
      const parsed = JSON.parse(savedCustomer) as Partial<CheckoutCustomerDraft>
      if (parsed.name) defaults.name = parsed.name
      if (parsed.email) defaults.email = parsed.email
      if (parsed.phone) defaults.phone = formatBdPhoneInput(parsed.phone)
      if (parsed.address) defaults.address = parsed.address
      if (parsed.city && isBdDistrict(parsed.city)) defaults.city = parsed.city
    }
  } catch {
    // ignore corrupt local storage
  }

  try {
    const savedAuth = window.localStorage.getItem('splaro-auth')
    if (savedAuth) {
      const parsed = JSON.parse(savedAuth) as { state?: { user?: Partial<CheckoutCustomerDraft> } }
      const user = parsed.state?.user
      if (user?.name) defaults.name = user.name
      if (user?.email) defaults.email = user.email
      if (user?.phone) defaults.phone = formatBdPhoneInput(user.phone)
    }
  } catch {
    // ignore corrupt local storage
  }

  return defaults
}
