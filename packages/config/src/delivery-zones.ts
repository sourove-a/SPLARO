/**
 * Bangladesh delivery zones and charges
 * Used by checkout, order validation, and courier selection
 */

export const DELIVERY_ZONES = {
  INSIDE_DHAKA: {
    label: 'Inside Dhaka City',
    charge: 60,
    estimatedDays: '1–2',
    sameDayCharge: 100,
    sameDayCutoff: '14:00', // 2PM BDT
    courierPreference: 'STEADFAST' as const,
    areas: [
      'Dhanmondi', 'Gulshan', 'Banani', 'Uttara', 'Mirpur', 'Mohammadpur',
      'Rayer Bazar', 'Hazaribagh', 'Lalbagh', 'Old Dhaka', 'Motijheel',
      'Tejgaon', 'Farmgate', 'Shahbag', 'Ramna', 'Paltan', 'Wari',
      'Khilgaon', 'Rampura', 'Badda', 'Vatara', 'Baridhara', 'Bashundhara',
      'Nikunja', 'Kafrul', 'Pallabi', 'Savar', 'Ashulia', 'Tongi',
      'Gazipur City', 'Keraniganj', 'Narayanganj City',
    ],
  },
  OUTSIDE_DHAKA: {
    label: 'Outside Dhaka',
    charge: 120,
    estimatedDays: '3–5',
    expressCharge: 180,
    expressDays: '2–3',
    courierPreference: 'REDX' as const,
  },
  FREE_DELIVERY_THRESHOLD: 3000, // BDT
} as const

export type DeliveryZone = 'INSIDE_DHAKA' | 'OUTSIDE_DHAKA'

export function getDeliveryCharge(zone: DeliveryZone, orderTotal: number): number {
  if (orderTotal >= DELIVERY_ZONES.FREE_DELIVERY_THRESHOLD) return 0
  return zone === 'INSIDE_DHAKA'
    ? DELIVERY_ZONES.INSIDE_DHAKA.charge
    : DELIVERY_ZONES.OUTSIDE_DHAKA.charge
}

export function detectDhakaArea(city: string, district: string): boolean {
  const normalized = city.toLowerCase().trim()
  const dist = district.toLowerCase().trim()

  if (dist !== 'dhaka' && dist !== 'narayanganj' && dist !== 'gazipur') return false

  return DELIVERY_ZONES.INSIDE_DHAKA.areas.some(
    (area) => normalized.includes(area.toLowerCase()) || area.toLowerCase().includes(normalized),
  )
}

export function isSameDayEligible(): boolean {
  const now = new Date()
  const bdt = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Dhaka' }))
  const hours = bdt.getHours()
  const minutes = bdt.getMinutes()
  const cutoffHour = 14 // 2PM

  return hours < cutoffHour || (hours === cutoffHour && minutes === 0)
}
