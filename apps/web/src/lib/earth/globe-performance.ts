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

/** False on RDP / software GL / blocked WebGL — story earth uses CSS fallback instead. */
export function canUseWebGL(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const canvas = document.createElement('canvas')
    const ctx =
      canvas.getContext('webgl2') ??
      canvas.getContext('webgl') ??
      canvas.getContext('experimental-webgl')
    return Boolean(ctx)
  } catch {
    return false
  }
}

const SOFTWARE_RENDERER_MARKERS = [
  'swiftshader',
  'llvmpipe',
  'microsoft basic render',
  'software rasterizer',
  'mesa offscreen',
  'angle (microsoft basic render driver)',
]

/** True on RDP / software GL — use CSS earth, skip WebGL attempt. */
export function isSoftwareRenderer(): boolean {
  if (!canUseWebGL()) return true
  try {
    const canvas = document.createElement('canvas')
    const gl =
      canvas.getContext('webgl') ??
      (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null)
    if (!gl) return true

    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info')
    if (!debugInfo) return false

    const renderer = String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)).toLowerCase()
    return SOFTWARE_RENDERER_MARKERS.some((marker) => renderer.includes(marker))
  } catch {
    return true
  }
}

export function isLowPowerDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
  if (memory !== undefined && memory <= 4) return true
  return isSoftwareRenderer()
}

/** Story/footer 3D earth — CSS fallback on RDP, reduced motion, or blocked WebGL. */
export function shouldUseWebGLEarth(): boolean {
  if (prefersReducedMotion()) return false
  if (!canUseWebGL()) return false
  if (isSoftwareRenderer()) return false
  return true
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
