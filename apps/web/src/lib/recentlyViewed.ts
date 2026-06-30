const STORAGE_KEY = 'splaro-recently-viewed'
const MAX_ITEMS = 8

export function trackRecentlyViewed(productId: string) {
  if (typeof window === 'undefined') return

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const existing = raw ? (JSON.parse(raw) as string[]) : []
    const next = [productId, ...existing.filter((id) => id !== productId)].slice(0, MAX_ITEMS)
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([productId]))
  }
}

export function getRecentlyViewed(excludeId?: string): string[] {
  if (typeof window === 'undefined') return []

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const ids = raw ? (JSON.parse(raw) as string[]) : []
    return excludeId ? ids.filter((id) => id !== excludeId) : ids
  } catch {
    return []
  }
}
