'use client'

import { useEffect } from 'react'

const SCROLLING_ATTR = 'data-scrolling'
const IDLE_MS = 140

/**
 * While the user scrolls, mark html[data-scrolling="1"] so CSS can pause
 * continuous GPU animations (sheen sweeps, story spins). Clears quickly on idle
 * so the site still feels alive when resting — premium, not boring, not janky.
 */
export function ScrollActivityGate() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const root = document.documentElement
    let idleTimer = 0
    let active = false

    const onScrollActivity = () => {
      if (!active) {
        active = true
        root.setAttribute(SCROLLING_ATTR, '1')
      }
      window.clearTimeout(idleTimer)
      idleTimer = window.setTimeout(() => {
        active = false
        root.removeAttribute(SCROLLING_ATTR)
      }, IDLE_MS)
    }

    window.addEventListener('scroll', onScrollActivity, { passive: true, capture: true })
    window.addEventListener('wheel', onScrollActivity, { passive: true, capture: true })
    window.addEventListener('touchmove', onScrollActivity, { passive: true, capture: true })

    return () => {
      window.clearTimeout(idleTimer)
      root.removeAttribute(SCROLLING_ATTR)
      window.removeEventListener('scroll', onScrollActivity, true)
      window.removeEventListener('wheel', onScrollActivity, true)
      window.removeEventListener('touchmove', onScrollActivity, true)
    }
  }, [])

  return null
}
