'use client'

import { useEffect, useState } from 'react'

/** Layout phone (cards / bottom nav). */
const MOBILE_MQ = '(max-width: 768px)'
/**
 * Touch UI — phones, landscape phones, and tablets.
 * Must match detectScrollProfile('mobile') (≤1023 OR coarse) so Auth/Lenis/earth
 * don't treat a landscape phone as desktop.
 */
const TOUCH_UI_MQ = '(max-width: 1023px), (pointer: coarse)'

/**
 * Phone viewport (≤768px). Always `false` on SSR and during hydration — updates after mount.
 */
export function useMobileViewport(): boolean {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_MQ)
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  return isMobile
}

export function isMobileViewport(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia(MOBILE_MQ).matches
}

/** Phone / tablet / coarse pointer — Lenis, auth earth, footer video gates. */
export function isTouchUiViewport(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia(TOUCH_UI_MQ).matches
}

export function useTouchUiViewport(): boolean {
  const [isTouchUi, setIsTouchUi] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia(TOUCH_UI_MQ)
    const update = () => setIsTouchUi(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  return isTouchUi
}

/** True at `minWidth` and above. Always `false` on SSR and during hydration. */
export function useMinWidth(minWidth: number): boolean {
  const query = `(min-width: ${minWidth}px)`
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia(query)
    const update = () => setMatches(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [query])

  return matches
}

export function isMinWidth(minWidth: number): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia(`(min-width: ${minWidth}px)`).matches
}

/** True after the component has mounted on the client (safe for post-hydration-only UI). */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  return mounted
}
