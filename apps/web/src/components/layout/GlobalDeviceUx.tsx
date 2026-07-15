'use client'

import { useEffect, useLayoutEffect } from 'react'
import { unlockLenisPointer } from '@/lib/motion/unlock-lenis-pointer'
import { applyScrollProfileAttributes, detectScrollProfile } from '@/lib/motion/scroll'
import { isLowPowerDevice } from '@/lib/earth/globe-performance'
import { useUiStore } from '@/store/uiStore'

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
    const touchUi =
      window.matchMedia('(max-width: 1023px)').matches ||
      window.matchMedia('(pointer: coarse)').matches

    // Phones/tablets: lite paint (no glass blur animations fighting LCP).
    if (isLowPowerDevice() || saveData || touchUi) {
      html.setAttribute('data-perf', 'lite')
    } else {
      html.removeAttribute('data-perf')
    }
  }, [])

  return null
}

/**
 * Always mark overlay scroll-lock (even when Lenis is off / native scroll).
 * CSS: html[data-scroll-engine=native][data-scroll-lock=overlay] { overflow:hidden }
 * — Search/Cart/SizeGuide must freeze background wheel on Windows.
 */
export function OverlayScrollLockAttr() {
  const locked = useUiStore(
    (s) => s.isMobileMenuOpen || s.isSearchOpen || s.isCartOpen || s.scrollLockCount > 0,
  )

  useLayoutEffect(() => {
    const html = document.documentElement
    if (locked) {
      html.setAttribute('data-scroll-lock', 'overlay')
    } else {
      html.removeAttribute('data-scroll-lock')
    }
  }, [locked])

  return null
}

/**
 * Maps vertical mouse wheel → horizontal scroll for any overflow-x container under the cursor.
 * Covers legacy tracks without HorizontalScrollRail (Windows mouse UX).
 * Never steal vertical page scroll — only [data-h-scroll="true"] rails.
 */
export function GlobalHorizontalWheelScroll() {
  useEffect(() => {
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey) return
      if (event.defaultPrevented) return
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return
      // Background page must keep wheel while Search/Cart is closed
      if (document.documentElement.getAttribute('data-scroll-lock') === 'overlay') return

      const target = event.target as HTMLElement | null
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
