import type { LenisOptions, ScrollToOptions } from 'lenis'

/** Expo-out — matches SPLARO --transition-expo feel */
export const scrollEaseOutExpo = (t: number) =>
  t >= 1 ? 1 : 1 - 2 ** (-10 * t)

/** Fixed header clearance for in-page anchors */
export const SCROLL_ANCHOR_OFFSET = -120

export const SCROLL_TO_TOP: ScrollToOptions = {
  duration: 0.85,
  easing: scrollEaseOutExpo,
}

export const SCROLL_ROUTE_TOP: ScrollToOptions = {
  duration: 0.4,
  easing: scrollEaseOutExpo,
}

export const SCROLL_ANCHOR: ScrollToOptions = {
  offset: SCROLL_ANCHOR_OFFSET,
  duration: 1.0,
  easing: scrollEaseOutExpo,
}

const LENIS_SHARED = {
  infinite: false,
  orientation: 'vertical' as const,
  gestureOrientation: 'vertical' as const,
  autoRaf: true,
  autoToggle: false,
  overscroll: true,
  allowNestedScroll: true,
  anchors: SCROLL_ANCHOR,
} satisfies Partial<LenisOptions>

const LENIS_DESKTOP_OPTIONS = {
  ...LENIS_SHARED,
  lerp: 0.115,
  smoothWheel: true,
  wheelMultiplier: 1.05,
  syncTouch: false,
  touchMultiplier: 1,
} satisfies LenisOptions

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

export function isWindowsClient(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Windows/i.test(navigator.userAgent)
}

export function isTouchScrollProfile() {
  const mq = getScrollMedia()
  if (!mq) return false
  return mq.coarse.matches || mq.mobileLayout.matches
}

export function buildLenisOptions(): LenisOptions {
  return LENIS_DESKTOP_OPTIONS
}

/**
 * Lenis disabled site-wide — native scroll only.
 * Smooth wheel capture breaks Windows Chrome/Brave (dead scroll/clicks after deploy).
 * Re-enable only after verified per-OS; Mac native scroll is fine for launch.
 */
export function isSmoothScrollEligible() {
  return false
}

/** @deprecated use isSmoothScrollEligible */
export function isSmoothScrollEnabled() {
  return isSmoothScrollEligible()
}

export function subscribeSmoothScrollEligibility(onChange: (eligible: boolean) => void) {
  onChange(false)
  return () => {}
}
