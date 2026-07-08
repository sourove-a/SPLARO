import { isValidBdMobile } from '@/lib/checkout/phone'

export interface CheckoutDeliveryFields {
  name: string
  email: string
  phone: string
  address: string
  city: string
  thana: string
}

export function isDeliveryComplete(fields: CheckoutDeliveryFields, phoneError?: string): boolean {
  if (phoneError) return false
  return (
    fields.name.trim().length > 0 &&
    fields.email.trim().length > 0 &&
    isValidBdMobile(fields.phone) &&
    fields.address.trim().length > 0 &&
    Boolean(fields.city) &&
    Boolean(fields.thana)
  )
}

export function deliveryFieldProgress(fields: CheckoutDeliveryFields): number {
  let filled = 0
  if (fields.name.trim()) filled += 1
  if (fields.email.trim()) filled += 1
  if (isValidBdMobile(fields.phone)) filled += 1
  if (fields.address.trim()) filled += 1
  if (fields.city && fields.thana) filled += 1
  return filled / 5
}

export type CheckoutStepStatus = 'pending' | 'active' | 'complete'

const STEPS_WITHOUT_PROMO = ['Delivery', 'Payment', 'Confirm'] as const
const STEPS_WITH_PROMO = ['Delivery', 'Promo code', 'Payment', 'Confirm'] as const

export function getCheckoutSteps(hasPromoStep: boolean): readonly string[] {
  return hasPromoStep ? STEPS_WITH_PROMO : STEPS_WITHOUT_PROMO
}

export function getCheckoutStepStatuses(
  deliveryComplete: boolean,
  paymentEngaged: boolean,
  submitting = false,
  hasPromoStep = false,
): CheckoutStepStatus[] {
  if (hasPromoStep) {
    if (!deliveryComplete) return ['active', 'pending', 'pending', 'pending']
    if (!paymentEngaged) return ['complete', 'active', 'pending', 'pending']
    if (submitting) return ['complete', 'complete', 'complete', 'active']
    return ['complete', 'complete', 'active', 'pending']
  }

  if (!deliveryComplete) return ['active', 'pending', 'pending']
  if (!paymentEngaged) return ['complete', 'active', 'pending']
  if (submitting) return ['complete', 'complete', 'active']
  return ['complete', 'complete', 'pending']
}

export function getCheckoutProgressLine(
  deliveryComplete: boolean,
  fieldProgress: number,
  hasPromoStep = false,
): number {
  if (deliveryComplete) return 100
  const span = hasPromoStep ? 40 : 50
  return Math.round(fieldProgress * span)
}
