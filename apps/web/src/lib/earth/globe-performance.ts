/** Phone layout — matches useMobileViewport (≤768px). */
export function isPhoneViewport(width = typeof window !== 'undefined' ? window.innerWidth : 1024): boolean {
  return width <= 768
}

/** Matches FOOTER_CONFIG.initialRotationY — keeps CSS fallback aligned with WebGL. */
export const FOOTER_EARTH_MAP_X_PERCENT = `${((1.28 / (2 * Math.PI)) * 100).toFixed(1)}%`

/** Browsers cap WebGL contexts (~8–16). Track live instances — dev HMR can orphan counts. */
const MAX_LIVE_EARTH_CONTEXTS = 2
const activeEarthSlots = new Set<string>()

export function acquireEarthWebGLSlot(token: string): boolean {
  if (activeEarthSlots.has(token)) return true
  if (activeEarthSlots.size >= MAX_LIVE_EARTH_CONTEXTS) return false
  activeEarthSlots.add(token)
  return true
}

export function releaseEarthWebGLSlot(token: string): void {
  activeEarthSlots.delete(token)
}

/** Call once per full page load — reload destroys GPU contexts but module state persists in dev. */
export function resetEarthWebGLSlots(): void {
  activeEarthSlots.clear()
}

/** Schedule heavy WebGL work after first paint / idle — avoids jank on refresh. */
export function scheduleEarthWebGLActivation(run: () => void): () => void {
  if (typeof window === 'undefined') return () => {}

  const win = window as Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
    cancelIdleCallback?: (id: number) => void
  }

  let idleId: number | undefined
  let timer: ReturnType<typeof setTimeout> | undefined

  const invoke = () => {
    timer = setTimeout(run, 120)
  }

  if (win.requestIdleCallback) {
    idleId = win.requestIdleCallback(invoke, { timeout: 900 })
  } else {
    timer = setTimeout(invoke, 350)
  }

  return () => {
    if (idleId !== undefined) win.cancelIdleCallback?.(idleId)
    if (timer !== undefined) clearTimeout(timer)
  }
}

export function globePixelRatioCap(configCap: number): number {
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
  if (isPhoneViewport()) return Math.min(dpr, 1.5)
  if (isLowPowerDevice()) return Math.min(dpr, 1.25)
  return Math.min(dpr, configCap)
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function isWindowsOS(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Windows/i.test(navigator.userAgent || '')
}

/** Fine-pointer + wide viewport Windows — used for RAM lite bypass only. */
export function isWindowsDesktop(): boolean {
  if (typeof window === 'undefined') return false
  if (!isWindowsOS()) return false
  const fine = window.matchMedia('(pointer: fine)').matches
  const desktop = window.innerWidth > 1023
  return fine && desktop
}

/** False on RDP / software GL / blocked WebGL — story earth uses CSS fallback instead. */
let canUseWebGLCache: boolean | null = null
export function canUseWebGL(): boolean {
  if (typeof window === 'undefined') return false
  if (canUseWebGLCache !== null) return canUseWebGLCache
  try {
    const canvas = document.createElement('canvas')
    const ctx =
      canvas.getContext('webgl2') ??
      canvas.getContext('webgl') ??
      canvas.getContext('experimental-webgl')
    canUseWebGLCache = Boolean(ctx)
  } catch {
    canUseWebGLCache = false
  }
  return canUseWebGLCache
}

const SOFTWARE_RENDERER_MARKERS = [
  'swiftshader',
  'llvmpipe',
  'microsoft basic render',
  'software rasterizer',
  'mesa offscreen',
  'angle (microsoft basic render driver)',
  'google swiftshader',
]

/** True on RDP / software GL — use CSS earth, skip WebGL attempt. */
let softwareRendererCache: boolean | null = null
export function isSoftwareRenderer(): boolean {
  if (softwareRendererCache !== null) return softwareRendererCache
  if (!canUseWebGL()) {
    softwareRendererCache = true
    return true
  }
  try {
    const canvas = document.createElement('canvas')
    const gl =
      canvas.getContext('webgl') ??
      (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null)
    if (!gl) {
      softwareRendererCache = true
      return true
    }

    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info')
    if (!debugInfo) {
      softwareRendererCache = false
      return false
    }

    const renderer = String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)).toLowerCase()
    softwareRendererCache = SOFTWARE_RENDERER_MARKERS.some((marker) => renderer.includes(marker))
  } catch {
    softwareRendererCache = true
  }
  return softwareRendererCache
}

/**
 * Lite paint / scroll profile.
 * Soft-GL MUST win over the Windows desktop bypass — previously Win desktop
 * returned false before soft-GL was checked, forcing WebGL+Lenis+blur on CPU.
 */
export function isLowPowerDevice(): boolean {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return false

  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
  if (conn?.saveData) return true

  // RDP / HA-off / SwiftShader — always lite (check BEFORE Windows bypass).
  if (isSoftwareRenderer()) return true

  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
  if (memory !== undefined && memory <= 2) {
    // Chromium often under-reports RAM on Windows; only trust ≤2GB on non-Win-desktop.
    if (!isWindowsDesktop()) return true
  }

  return false
}

export type EarthMotionOptions = { decorative?: boolean }

/** Story/footer 3D earth — CSS fallback on Windows, RDP, reduced motion, or blocked WebGL. */
export function shouldUseWebGLEarth(options?: EarthMotionOptions): boolean {
  if (!options?.decorative && prefersReducedMotion()) return false
  if (!canUseWebGL()) return false
  if (isSoftwareRenderer()) return false
  // Decorative story/footer WebGL — hard-off on ANY Windows (incl. touch / narrow).
  // Width/pointer gates used to re-enable WebGL on Surface / resized windows → GPU stall.
  if (options?.decorative && isWindowsOS()) return false
  // Phones/tablets: three.js story earth stalls first paint — CSS globe only.
  if (
    options?.decorative &&
    (window.matchMedia('(max-width: 1023px)').matches ||
      window.matchMedia('(pointer: coarse)').matches)
  ) {
    return false
  }
  return true
}

/** Defer heavy earth asset preload on save-data / reduced-motion — not on mobile alone. */
export function shouldPreloadEarthAssets(options?: EarthMotionOptions): boolean {
  if (!options?.decorative && prefersReducedMotion()) return false
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
  if (conn?.saveData) return false
  if (isSoftwareRenderer()) return false
  return true
}

/** Native OS scroll everywhere — Instagram-level responsiveness (2026-07-16). */
export function shouldUseNativeScroll(): boolean {
  if (typeof window === 'undefined') return true
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
