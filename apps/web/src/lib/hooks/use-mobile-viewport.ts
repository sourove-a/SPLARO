'use client'

import { useEffect, useState } from 'react'

const MOBILE_MQ = '(max-width: 768px)'

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
