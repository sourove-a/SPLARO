import type { LenisOptions, ScrollToOptions } from 'lenis'

/** Expo-out — matches SPLARO --transition-expo feel */
export const scrollEaseOutExpo = (t: number) =>
  t >= 1 ? 1 : 1 - 2 ** (-10 * t)

/** Fixed header clearance for in-page anchors */
export const SCROLL_ANCHOR_OFFSET = -120

export const SCROLL_TO_TOP: ScrollToOptions = {
  duration: 1.1,
  easing: scrollEaseOutExpo,
}

export const SCROLL_ROUTE_TOP: ScrollToOptions = {
  duration: 0.55,
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

/** Desktop wheel — lerp inertia, no syncTouch */
const LENIS_DESKTOP_OPTIONS = {
  ...LENIS_SHARED,
  lerp: 0.072,
  smoothWheel: true,
  wheelMultiplier: 0.88,
  syncTouch: false,
  touchMultiplier: 1,
} satisfies LenisOptions

/**
 * Mobile / touch — premium Lenis inertia without fighting native momentum.
 * Higher lerp + syncTouch keeps swipe feel fluid on iOS/Android.
 */
const LENIS_TOUCH_OPTIONS = {
  ...LENIS_SHARED,
  lerp: 0.095,
  smoothWheel: false,
  wheelMultiplier: 1,
  syncTouch: true,
  touchMultiplier: 1.05,
} satisfies LenisOptions

function getScrollMedia() {
  if (typeof window === 'undefined') return null
  return {
    reduced: window.matchMedia('(prefers-reduced-motion: reduce)'),
    coarse: window.matchMedia('(pointer: coarse)'),
    mobileLayout: window.matchMedia('(max-width: 1023px)'),
  }
}

export function isTouchScrollProfile() {
  const mq = getScrollMedia()
  if (!mq) return false
  return mq.coarse.matches || mq.mobileLayout.matches
}

export function buildLenisOptions(): LenisOptions {
  return isTouchScrollProfile() ? LENIS_TOUCH_OPTIONS : LENIS_DESKTOP_OPTIONS
}

/** All viewports except reduced-motion — mobile uses touch-tuned Lenis. */
export function isSmoothScrollEligible() {
  const mq = getScrollMedia()
  if (!mq) return false
  return !mq.reduced.matches
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

  const sync = () => onChange(isSmoothScrollEligible())
  sync()

  mq.reduced.addEventListener('change', sync)
  mq.coarse.addEventListener('change', sync)
  mq.mobileLayout.addEventListener('change', sync)

  return () => {
    mq.reduced.removeEventListener('change', sync)
    mq.coarse.removeEventListener('change', sync)
    mq.mobileLayout.removeEventListener('change', sync)
  }
}
