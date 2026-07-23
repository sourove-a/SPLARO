import type { LenisOptions, ScrollToOptions, VirtualScrollData } from 'lenis'
import { shouldUseNativeScroll } from '@/lib/earth/globe-performance'

/** Expo-out — matches SPLARO --transition-expo feel */
export const scrollEaseOutExpo = (t: number) =>
  t >= 1 ? 1 : 1 - 2 ** (-10 * t)

/** Fixed header clearance for in-page anchors */
export const SCROLL_ANCHOR_OFFSET = -120

export const SCROLL_TO_TOP: ScrollToOptions = {
  duration: 0.72,
  easing: scrollEaseOutExpo,
}

/** Soft route changes — snap (no animated jump) */
export const SCROLL_ROUTE_TOP: ScrollToOptions = {
  immediate: true,
}

/** Hard reload / bfcache — snap without animation */
export const SCROLL_BOOT: ScrollToOptions = {
  immediate: true,
}

export const SCROLL_ANCHOR: ScrollToOptions = {
  offset: SCROLL_ANCHOR_OFFSET,
  duration: 0.65,
  easing: scrollEaseOutExpo,
}

export type ScrollProfile = 'mac' | 'windows' | 'mobile'

/** Nested overlays and form fields stay native. Horizontal rails must NOT
 *  blanket-prevent — that froze vertical page scroll over mid-page product rows. */
const lenisPreventNode = (node: HTMLElement) => {
  const tag = node.tagName
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true
  return Boolean(
    node.closest(
      '[data-lenis-prevent],[data-lenis-prevent-wheel],[data-lenis-prevent-touch]',
    ),
  )
}

/**
 * Only hand off to horizontal rails when the gesture is clearly horizontal.
 * Vertical wheel over product carousels must keep driving the page.
 * Return false to stop Lenis from consuming the event.
 */
const lenisVirtualScroll = (data: VirtualScrollData): boolean => {
  const target = data.event.target
  if (!(target instanceof Element)) return true
  const rail = target.closest('[data-h-scroll="true"]') as HTMLElement | null
  if (!rail) return true

  const horizontal = Math.abs(data.deltaX) > Math.abs(data.deltaY)
  if (!horizontal) return true

  const max = rail.scrollWidth - rail.clientWidth
  if (max <= 1) return true

  const goingRight = data.deltaX > 0
  const atStart = rail.scrollLeft <= 1
  const atEnd = rail.scrollLeft >= max - 1
  if ((goingRight && atEnd) || (!goingRight && atStart)) return true

  data.event.preventDefault()
  rail.scrollLeft += data.deltaX
  return false
}

const LENIS_SHARED = {
  infinite: false,
  orientation: 'vertical' as const,
  gestureOrientation: 'vertical' as const,
  autoRaf: true,
  /** Keep limit in sync as product rails / images load — false caused mid-page freeze. */
  autoResize: true,
  overscroll: true,
  allowNestedScroll: true,
  stopInertiaOnNavigate: true,
  anchors: SCROLL_ANCHOR,
  easing: scrollEaseOutExpo,
  prevent: lenisPreventNode,
  virtualScroll: lenisVirtualScroll,
} satisfies Partial<LenisOptions>

/**
 * Mac / Linux desktop — lerp (not duration) for continuous trackpad/mouse wheel.
 * duration:1 restarted a 1s ease on every wheel delta → sticky + skipped frames.
 * Do not set duration + lerp together.
 */
const LENIS_DESKTOP: LenisOptions = {
  ...LENIS_SHARED,
  /** Snappier than 0.085 — premium glide without sticky / laggy scroll feel. */
  lerp: 0.1,
  smoothWheel: true,
  wheelMultiplier: 0.95,
  syncTouch: false,
  touchMultiplier: 1,
  autoToggle: false,
}

/** Windows desktop profile — unused; Windows always uses native scroll. */
const LENIS_WINDOWS: LenisOptions = {
  ...LENIS_SHARED,
  lerp: 0.1,
  smoothWheel: true,
  wheelMultiplier: 0.9,
  syncTouch: false,
  touchMultiplier: 1,
  autoToggle: false,
}

/**
 * Phone / tablet profile — syncTouch MUST stay false.
 * Mobile prefers native via shouldUseNativeScroll; profile kept as safety net.
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
 * Lenis only when native scroll is not required (Mac fine desktop).
 * Soft-GL + Lenis RAF + decorative WebGL starved Windows main thread.
 */
export function isSmoothScrollEligible() {
  if (typeof window === 'undefined') return false
  return !shouldUseNativeScroll()
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
  mq.coarse.addEventListener('change', update)
  mq.mobileLayout.addEventListener('change', update)

  return () => {
    mq.reduced.removeEventListener('change', update)
    mq.coarse.removeEventListener('change', update)
    mq.mobileLayout.removeEventListener('change', update)
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
