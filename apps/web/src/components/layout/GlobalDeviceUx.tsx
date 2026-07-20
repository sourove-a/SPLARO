'use client'

import { useEffect, useLayoutEffect, useRef } from 'react'
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
 * Allow wheel/touch only inside a real overflow scroller that still has room.
 * Never treat `[data-lenis-prevent]` / `[data-h-scroll]` as a free pass — that
 * chained wheel to the page behind cart/search/menu (F-001).
 */
function isScrollableOverflowY(el: HTMLElement): boolean {
  const { overflowY } = getComputedStyle(el)
  if (overflowY !== 'auto' && overflowY !== 'scroll' && overflowY !== 'overlay') return false
  return el.scrollHeight > el.clientHeight + 1
}

function findScrollableAncestor(start: Element, root: Element): HTMLElement | null {
  let el: Element | null = start
  while (el && root.contains(el)) {
    if (el instanceof HTMLElement && isScrollableOverflowY(el)) return el
    if (el === root) break
    el = el.parentElement
  }
  return null
}

function shouldAllowOverlayInnerScroll(target: EventTarget | null, deltaY: number): boolean {
  if (!(target instanceof Element)) return false
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
    return true
  }
  const pane = target.closest(
    '[data-overlay-scroll], [role="dialog"], [data-lenis-prevent], [data-lenis-prevent-wheel]',
  )
  if (!(pane instanceof Element)) return false

  const scroller = findScrollableAncestor(target, pane)
  if (!scroller) return false

  const atTop = scroller.scrollTop <= 0
  const atBottom = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1
  if (deltaY < 0 && atTop) return false
  if (deltaY > 0 && atBottom) return false
  return true
}

/**
 * Always mark overlay scroll-lock (even when Lenis is off / native scroll).
 * CSS + non-passive wheel/touch blockers freeze the page behind overlays.
 * Body `position:fixed` keeps the visual offset when browsers reset scrollY.
 */
export function OverlayScrollLockAttr() {
  const locked = useUiStore(
    (s) => s.isMobileMenuOpen || s.isSearchOpen || s.isCartOpen || s.scrollLockCount > 0,
  )
  const stableScrollY = useRef(0)
  const unlockScrollY = useRef(0)

  useEffect(() => {
    let settleTimer = 0
    const readY = () => {
      const lenis = (window as Window & { __SPLARO_LENIS?: { scroll?: number } }).__SPLARO_LENIS
      if (typeof lenis?.scroll === 'number' && Number.isFinite(lenis.scroll)) return lenis.scroll
      return window.scrollY
    }
    const remember = () => {
      if (document.documentElement.getAttribute('data-scroll-lock') === 'overlay') return
      const y = readY()
      if (y > 0) stableScrollY.current = y
      window.clearTimeout(settleTimer)
      settleTimer = window.setTimeout(() => {
        if (document.documentElement.getAttribute('data-scroll-lock') === 'overlay') return
        stableScrollY.current = readY()
      }, 120)
    }
    // Capture before click/focus can zero scroll (cart icon scrollIntoView, etc.).
    const onPointerDown = () => {
      if (document.documentElement.getAttribute('data-scroll-lock') === 'overlay') return
      const y = readY()
      if (y > 0) stableScrollY.current = y
    }
    stableScrollY.current = readY()
    window.addEventListener('scroll', remember, { passive: true })
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => {
      window.clearTimeout(settleTimer)
      window.removeEventListener('scroll', remember)
      document.removeEventListener('pointerdown', onPointerDown, true)
    }
  }, [])

  useLayoutEffect(() => {
    const html = document.documentElement
    const body = document.body
    const lenisEngine = html.getAttribute('data-scroll-engine') === 'lenis'
    const lenis = (window as Window & { __SPLARO_LENIS?: { scrollTo: (v: number, o?: object) => void; scroll: number } })
      .__SPLARO_LENIS

    if (!locked) {
      const y = unlockScrollY.current
      html.removeAttribute('data-scroll-lock')
      html.removeAttribute('data-scroll-lock-y')
      html.style.removeProperty('--splaro-scroll-lock-y')
      body.style.removeProperty('position')
      body.style.removeProperty('top')
      body.style.removeProperty('left')
      body.style.removeProperty('right')
      body.style.removeProperty('width')
      if (lenisEngine && lenis) {
        lenis.scrollTo(y, { immediate: true })
      } else {
        window.scrollTo(0, y)
      }
      stableScrollY.current = y
      return
    }

    const liveY =
      lenisEngine && typeof lenis?.scroll === 'number' ? lenis.scroll : window.scrollY
    const freezeY = liveY > 0 ? liveY : Math.max(0, stableScrollY.current)
    unlockScrollY.current = freezeY
    html.setAttribute('data-scroll-lock-y', String(freezeY))
    html.style.setProperty('--splaro-scroll-lock-y', `-${freezeY}px`)
    html.setAttribute('data-scroll-lock', 'overlay')

    // Pin visually for both engines — Lenis.stop() alone can report scroll=0 and jump the page.
    body.style.position = 'fixed'
    body.style.top = `-${freezeY}px`
    body.style.left = '0'
    body.style.right = '0'
    body.style.width = '100%'
    if (lenisEngine && lenis) {
      lenis.scrollTo(freezeY, { immediate: true })
    }
  }, [locked])

  useEffect(() => {
    if (!locked) return

    const blockPageWheel = (event: WheelEvent) => {
      if (shouldAllowOverlayInnerScroll(event.target, event.deltaY)) return
      event.preventDefault()
    }

    const blockPageTouch = (event: TouchEvent) => {
      if (shouldAllowOverlayInnerScroll(event.target, 0)) return
      event.preventDefault()
    }

    document.addEventListener('wheel', blockPageWheel, { passive: false, capture: true })
    document.addEventListener('touchmove', blockPageTouch, { passive: false, capture: true })

    return () => {
      document.removeEventListener('wheel', blockPageWheel, { capture: true })
      document.removeEventListener('touchmove', blockPageTouch, { capture: true })
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
