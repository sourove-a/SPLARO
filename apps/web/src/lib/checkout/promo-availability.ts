export interface PromoAvailability {
  hasActivePromo: boolean
}

export async function fetchPromoAvailability(): Promise<PromoAvailability> {
  try {
    const res = await fetch('/api/promos/availability', { cache: 'no-store' })
    if (!res.ok) return { hasActivePromo: false }
    const payload = (await res.json()) as { hasActivePromo?: boolean }
    return { hasActivePromo: Boolean(payload.hasActivePromo) }
  } catch {
    return { hasActivePromo: false }
  }
}
