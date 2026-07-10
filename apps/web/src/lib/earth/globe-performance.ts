/** Phone layout — matches useMobileViewport (≤768px). */
export function isPhoneViewport(width = typeof window !== 'undefined' ? window.innerWidth : 1024): boolean {
  return width <= 768
}

export function globePixelRatioCap(configCap: number): number {
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
  if (isPhoneViewport()) return Math.min(dpr, 1.5)
  return Math.min(dpr, configCap)
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Defer heavy earth asset preload on save-data / reduced-motion — not on mobile alone. */
export function shouldPreloadEarthAssets(): boolean {
  if (prefersReducedMotion()) return false
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
  if (conn?.saveData) return false
  return true
}

export function earthIntersectionRootMargin(compact = false): string {
  const vh = window.innerHeight
  const phone = isPhoneViewport()
  const topLead = Math.max(phone ? 200 : compact ? 220 : 320, Math.round(vh * (phone ? 0.32 : 0.45)))
  const bottom = phone ? 72 : 120
  return `${topLead}px 0px ${bottom}px`
}

export function isNearViewport(el: Element, leadPx = 280): boolean {
  const rect = el.getBoundingClientRect()
  const vh = window.innerHeight
  return rect.top <= vh + leadPx && rect.bottom >= -leadPx
}
