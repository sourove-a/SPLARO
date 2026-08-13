import { DELIVERY_ZONES } from '@splaro/config'
import { BD_DISTRICTS } from './bd-districts'
import { getThanasForDistrict } from './bd-thanas'

export function isDhakaDistrict(district: string | undefined): boolean {
  const normalized = district?.trim().toLowerCase() ?? ''
  return normalized === 'dhaka' || normalized === 'dhaka city' || normalized === 'ঢাকা'
}

export function defaultThanaForDistrict(district: string): string {
  const thanas = getThanasForDistrict(district)
  if (isDhakaDistrict(district) && thanas.includes('Uttara')) return 'Uttara'
  return thanas[0] ?? ''
}

export function computeManualOrderDelivery(
  subtotal: number,
  district: string,
  shipping?: {
    dhakaDeliveryCharge?: number
    outsideDhakaCharge?: number
    freeShippingMin?: string | number
  },
): number {
  if (subtotal <= 0) return 0
  const freeThreshold = Math.round(Number(shipping?.freeShippingMin ?? 0))
  if (freeThreshold > 0 && subtotal >= freeThreshold) return 0
  const dhaka = Math.round(Number(shipping?.dhakaDeliveryCharge ?? DELIVERY_ZONES.INSIDE_DHAKA.charge))
  const outside = Math.round(Number(shipping?.outsideDhakaCharge ?? DELIVERY_ZONES.OUTSIDE_DHAKA.charge))
  return isDhakaDistrict(district) ? dhaka : outside
}

export function composeStreetAddress(street: string, thana: string, district: string): string {
  const parts = street
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
  const drop = new Set(
    [thana, district].map((v) => v.trim().toLowerCase()).filter(Boolean),
  )
  while (parts.length && drop.has((parts[parts.length - 1] ?? '').toLowerCase())) {
    parts.pop()
  }
  return [...parts, thana.trim(), district.trim()].filter(Boolean).join(', ')
}

export { BD_DISTRICTS, getThanasForDistrict }
