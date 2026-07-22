export interface DeliveryChargeSettings {
  dhakaDeliveryCharge?: number | string | null
  outsideDhakaCharge?: number | string | null
  freeDeliveryThreshold?: number | string | null
}

export interface OrderCustomerLocation {
  city?: string
  district?: string
}

/** Storefront checkout stores the BD district in `city`; saved addresses may also set `district`. */
export function resolveOrderDistrict(customer: OrderCustomerLocation): string {
  return (customer.district ?? customer.city ?? '').trim()
}

/** Dhaka district gets the lower metro delivery rate (matches apps/web checkout). */
export function isDhakaDistrict(district: string | undefined): boolean {
  const normalized = district?.trim().toLowerCase() ?? ''
  return normalized === 'dhaka' || normalized === 'dhaka city' || normalized === 'ঢাকা'
}

/** Authoritative delivery fee from district + store settings (never trust client amount). */
export function computeExpectedDeliveryChargeBdt(
  district: string | undefined,
  settings: DeliveryChargeSettings,
  opts?: { subtotal?: number; freeShipping?: boolean },
): number {
  if (opts?.freeShipping) return 0

  const subtotal = opts?.subtotal
  if (subtotal !== undefined) {
    if (subtotal === 0) return 0
    const freeThreshold = Math.round(Number(settings.freeDeliveryThreshold ?? 0))
    if (freeThreshold > 0 && subtotal >= freeThreshold) return 0
  }

  const dhaka = Math.round(Number(settings.dhakaDeliveryCharge ?? 60))
  const outside = Math.round(Number(settings.outsideDhakaCharge ?? 120))
  return isDhakaDistrict(district) ? dhaka : outside
}
