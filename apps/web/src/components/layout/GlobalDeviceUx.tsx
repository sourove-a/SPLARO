'use client'

import { useEffect, useLayoutEffect } from 'react'
import { unlockLenisPointer } from '@/lib/motion/unlock-lenis-pointer'
import { applyScrollProfileAttributes, detectScrollProfile } from '@/lib/motion/scroll'
import { isLowPowerDevice, isWindowsOS } from '@/lib/earth/globe-performance'
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
 * Maps intentional horizontal wheel input onto overflow-x rails.
 * Plain vertical wheel must keep page scrolling, especially on Windows.
 */
export function GlobalHorizontalWheelScroll() {
  useEffect(() => {
    if (!isWindowsOS()) return

    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey) return
      if (event.defaultPrevented) return
      const wantsHorizontal = Math.abs(event.deltaX) > Math.abs(event.deltaY)
      const shiftWheel = event.shiftKey && Math.abs(event.deltaY) > Math.abs(event.deltaX)
      if (!wantsHorizontal && !shiftWheel) return
      if (document.documentElement.getAttribute('data-scroll-lock') === 'overlay') return

      const target = event.target as HTMLElement | null
      const rail = target?.closest('[data-h-scroll="true"]') as HTMLElement | null
      if (!rail) return
      const preventZone = target?.closest('[data-lenis-prevent]') as HTMLElement | null
      if (preventZone && preventZone !== rail) return

      const max = rail.scrollWidth - rail.clientWidth
      if (max <= 1) return
      const delta = wantsHorizontal ? event.deltaX : event.deltaY
      const goingRight = delta > 0
      if ((goingRight && rail.scrollLeft >= max - 1) || (!goingRight && rail.scrollLeft <= 1)) {
        return
      }

      event.preventDefault()
      rail.scrollLeft += delta
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
