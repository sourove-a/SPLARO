import type { LenisOptions, ScrollToOptions } from 'lenis'

/** Expo-out — matches SPLARO --transition-expo feel */
export const scrollEaseOutExpo = (t: number) =>
  t >= 1 ? 1 : 1 - 2 ** (-10 * t)

/** Fixed header clearance for in-page anchors */
export const SCROLL_ANCHOR_OFFSET = -120

export const SCROLL_TO_TOP: ScrollToOptions = {
  duration: 0.72,
  easing: scrollEaseOutExpo,
}

export const SCROLL_ROUTE_TOP: ScrollToOptions = {
  duration: 0.38,
  easing: scrollEaseOutExpo,
}

/** Hard reload / bfcache — snap without animation */
export const SCROLL_BOOT: ScrollToOptions = {
  immediate: true,
}

export const SCROLL_ANCHOR: ScrollToOptions = {
  offset: SCROLL_ANCHOR_OFFSET,
  duration: 1.05,
  easing: scrollEaseOutExpo,
}

export type ScrollProfile = 'mac' | 'windows' | 'mobile'

const LENIS_SHARED = {
  infinite: false,
  orientation: 'vertical' as const,
  gestureOrientation: 'vertical' as const,
  autoRaf: true,
  autoResize: false,
  overscroll: true,
  allowNestedScroll: true,
  stopInertiaOnNavigate: true,
  anchors: SCROLL_ANCHOR,
  easing: scrollEaseOutExpo,
} satisfies Partial<LenisOptions>

/** Mac / Linux desktop — luxury inertia without floaty lag */
const LENIS_DESKTOP: LenisOptions = {
  ...LENIS_SHARED,
  lerp: 0.1,
  smoothWheel: true,
  wheelMultiplier: 1,
  syncTouch: false,
  touchMultiplier: 1,
  autoToggle: false,
}

/** Windows desktop — snappier lerp (less RAF work) than Mac; soft-GL skips Lenis entirely */
const LENIS_WINDOWS: LenisOptions = {
  ...LENIS_SHARED,
  lerp: 0.14,
  smoothWheel: true,
  wheelMultiplier: 1,
  syncTouch: false,
  touchMultiplier: 1,
  autoToggle: false,
}

/**
 * Phone / tablet profile — syncTouch MUST stay false.
 * syncTouch:true fought native iOS/Android momentum → jump + dead taps.
 * Touch stays OS-native; this profile only matters if Lenis mounts (edge cases).
 */
const LENIS_MOBILE: LenisOptions = {
  ...LENIS_SHARED,
  lerp: 0.12,
  smoothWheel: false,
  syncTouch: false,
  touchMultiplier: 1,
  wheelMultiplier: 1,
  autoToggle: false,
  overscroll: false,
}

function getScrollMedia() {
  if (typeof window === 'undefined') return null
  return {
    reduced: window.matchMedia('(prefers-reduced-motion: reduce)'),
    coarse: window.matchMedia('(pointer: coarse)'),
    mobileLayout: window.matchMedia('(max-width: 1023px)'),
  }
}

export function isPrivateNetworkHost(): boolean {
  if (typeof window === 'undefined') return false
  const host = window.location.hostname
  if (host === 'localhost' || host === '127.0.0.1') return false
  return /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)
}

export function isTouchScrollProfile() {
  return detectScrollProfile() === 'mobile'
}

/** Runtime profile — boot script sets data-scroll-profile; JS refines on resize. */
export function detectScrollProfile(): ScrollProfile {
  if (typeof window === 'undefined') return 'mac'

  const mq = getScrollMedia()
  if (mq && (mq.coarse.matches || mq.mobileLayout.matches)) return 'mobile'

  const attr = document.documentElement.getAttribute('data-scroll-profile')
  if (attr === 'windows') return 'windows'
  if (attr === 'mobile') return 'mobile'
  if (attr === 'mac') return 'mac'

  const os = document.documentElement.getAttribute('data-os')
  if (os === 'windows') return 'windows'

  return 'mac'
}

export function applyScrollProfileAttributes(profile: ScrollProfile) {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-scroll-profile', profile)
}

export function buildLenisOptions(profile: ScrollProfile = detectScrollProfile()): LenisOptions {
  if (profile === 'mobile') return { ...LENIS_MOBILE }
  if (profile === 'windows') return { ...LENIS_WINDOWS }
  return { ...LENIS_DESKTOP }
}

/**
 * Lenis when motion is allowed AND the device isn't soft-GL/lite.
 * Soft-GL + Lenis RAF + decorative WebGL starved Windows main thread (Search lag).
 */
export function isSmoothScrollEligible() {
  const mq = getScrollMedia()
  if (!mq) return false
  if (mq.reduced.matches) return false
  if (typeof document !== 'undefined' && document.documentElement.getAttribute('data-perf') === 'lite') {
    return false
  }
  return true
}

/** @deprecated use isSmoothScrollEligible */
export function isSmoothScrollEnabled() {
  return isSmoothScrollEligible()
}

export function subscribeSmoothScrollEligibility(onChange: (eligible: boolean) => void) {
  const mq = getScrollMedia()
  if (!mq) {
    onChange(false)
    return () => {}
  }

  const update = () => onChange(isSmoothScrollEligible())
  update()
  mq.reduced.addEventListener('change', update)

  return () => {
    mq.reduced.removeEventListener('change', update)
  }
}

export function subscribeScrollProfile(onChange: (profile: ScrollProfile) => void) {
  if (typeof window === 'undefined') {
    onChange('mac')
    return () => {}
  }

  const update = () => {
    const profile = detectScrollProfile()
    applyScrollProfileAttributes(profile)
    onChange(profile)
  }

  update()
  window.addEventListener('resize', update)
  window.addEventListener('orientationchange', update)

  const mq = getScrollMedia()
  mq?.coarse.addEventListener('change', update)
  mq?.mobileLayout.addEventListener('change', update)

  return () => {
    window.removeEventListener('resize', update)
    window.removeEventListener('orientationchange', update)
    mq?.coarse.removeEventListener('change', update)
    mq?.mobileLayout.removeEventListener('change', update)
  }
}
