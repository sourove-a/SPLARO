export interface ShippingCharges {
  freeDeliveryThreshold: number
  dhakaDeliveryCharge: number
  outsideDhakaCharge: number
}

/** Dhaka district gets the lower metro delivery rate. */
export function isDhakaDistrict(district: string | undefined): boolean {
  return district?.trim().toLowerCase() === 'dhaka'
}

export function computeDeliveryFeeBdt(
  subtotal: number,
  district: string | undefined,
  shipping: ShippingCharges,
  opts?: { freeShipping?: boolean },
): number {
  if (opts?.freeShipping || subtotal === 0) return 0
  const threshold = shipping.freeDeliveryThreshold
  if (threshold > 0 && subtotal >= threshold) return 0
  return isDhakaDistrict(district)
    ? Math.round(shipping.dhakaDeliveryCharge)
    : Math.round(shipping.outsideDhakaCharge)
}
