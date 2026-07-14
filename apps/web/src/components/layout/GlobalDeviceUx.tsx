'use client'

import { useEffect, useLayoutEffect } from 'react'
import { unlockLenisPointer } from '@/lib/motion/unlock-lenis-pointer'
import { applyScrollProfileAttributes, detectScrollProfile } from '@/lib/motion/scroll'
import { isLowPowerDevice } from '@/lib/earth/globe-performance'

/**
 * Desktop Windows should match Mac: same scroll profile + full glass/motion unless truly low-power.
 */
export function DesktopPerfParity() {
  useLayoutEffect(() => {
    const html = document.documentElement
    const profile = detectScrollProfile()
    applyScrollProfileAttributes(profile)

    const saveData =
      (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true

    if (isLowPowerDevice() || saveData) {
      html.setAttribute('data-perf', 'lite')
    } else {
      html.removeAttribute('data-perf')
    }
  }, [])

  return null
}

/**
 * Maps vertical mouse wheel → horizontal scroll for any overflow-x container under the cursor.
 * Covers legacy tracks without HorizontalScrollRail (Windows mouse UX).
 */
export function GlobalHorizontalWheelScroll() {
  useEffect(() => {
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey) return
      if (event.defaultPrevented) return
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return

      const target = event.target as HTMLElement | null
      // Only explicit horizontal rails — never steal Lenis vertical wheel
      const rail = target?.closest('[data-h-scroll="true"]') as HTMLElement | null
      if (!rail) return
      if (target?.closest('[data-lenis-prevent]')) return

      const max = rail.scrollWidth - rail.clientWidth
      if (max <= 1) return
      const goingRight = event.deltaY > 0
      if ((goingRight && rail.scrollLeft >= max - 1) || (!goingRight && rail.scrollLeft <= 1)) {
        return
      }

      event.preventDefault()
      rail.scrollLeft += event.deltaY
    }

    document.addEventListener('wheel', onWheel, { passive: false, capture: true })
    return () => document.removeEventListener('wheel', onWheel, { capture: true })
  }, [])

  return null
}

/** Safety net — never leave the storefront unclickable after Lenis / overlay glitches. */
export function GlobalPointerSafety() {
  useLayoutEffect(() => {
    unlockLenisPointer()
  }, [])

  useEffect(() => {
    const unlock = () => unlockLenisPointer()

    unlock()
    document.addEventListener('pointerdown', unlock, true)
    document.addEventListener('visibilitychange', unlock)
    window.addEventListener('focus', unlock)

    return () => {
      document.removeEventListener('pointerdown', unlock, true)
      document.removeEventListener('visibilitychange', unlock)
      window.removeEventListener('focus', unlock)
      unlock()
    }
  }, [])

  return null
}
