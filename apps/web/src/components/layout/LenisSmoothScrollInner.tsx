'use client'

import { useLayoutEffect, useMemo, useRef, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { ReactLenis, useLenis } from 'lenis/react'
import { useUiStore } from '@/store/uiStore'
import { unlockLenisPointer } from '@/lib/motion/unlock-lenis-pointer'
import {
  buildLenisOptions,
  SCROLL_BOOT,
  SCROLL_ROUTE_TOP,
} from '@/lib/motion/scroll'

/** Survives click/focus zeroing window/lenis scroll before lock effects run. */
let lastLenisScrollY = 0

function rememberLenisScrollY(y: number) {
  if (Number.isFinite(y) && y > 0) lastLenisScrollY = y
}

function LenisBootSync() {
  const lenis = useLenis()
  const booted = useRef(false)

  useLayoutEffect(() => {
    if (!lenis || booted.current) return
    booted.current = true

    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual'
    }

    const html = document.documentElement
    html.setAttribute('data-scroll-engine', 'lenis')
    ;(window as Window & { __SPLARO_LENIS?: typeof lenis }).__SPLARO_LENIS = lenis
    lenis.start()
    lenis.resize()

    // Remount (e.g. sibling dynamic chunk) must NOT snap to top — that flashes
    // like a full reload when the header bag opens CartDrawer the first time.
    const overlayLocked = html.getAttribute('data-scroll-lock') === 'overlay'
    const lockY = Number(html.getAttribute('data-scroll-lock-y') || 0) || 0
    const restoreY = Math.max(0, lastLenisScrollY, lockY, window.scrollY)
    if (overlayLocked || restoreY > 1) {
      rememberLenisScrollY(restoreY)
      lenis.scrollTo(restoreY, { immediate: true })
    } else {
      lenis.scrollTo(0, SCROLL_BOOT)
    }
    unlockLenisPointer()

    const raf = requestAnimationFrame(() => {
      // Don't restart if an overlay already locked scroll during boot.
      if (html.getAttribute('data-scroll-lock') === 'overlay') return
      lenis.start()
      lenis.resize()
      unlockLenisPointer()
      html.setAttribute('data-lenis-ready', '1')
      html.setAttribute('data-splaro-booted', '1')
    })

    const onPageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return
      lenis.resize()
      lenis.scrollTo(0, SCROLL_BOOT)
      unlockLenisPointer()
    }

    window.addEventListener('pageshow', onPageShow)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pageshow', onPageShow)
      const win = window as Window & { __SPLARO_LENIS?: typeof lenis }
      if (win.__SPLARO_LENIS === lenis) delete win.__SPLARO_LENIS
      booted.current = false
    }
  }, [lenis])

  return null
}

function LenisRouteSync() {
  const pathname = usePathname()
  const lenis = useLenis()
  const isFirstRoute = useRef(true)
  const isPopNavigation = useRef(false)

  useLayoutEffect(() => {
    const onPopState = () => {
      isPopNavigation.current = true
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useLayoutEffect(() => {
    if (!lenis) return
    if (isFirstRoute.current) {
      isFirstRoute.current = false
      return
    }
    if (isPopNavigation.current) {
      isPopNavigation.current = false
      lenis.resize()
      unlockLenisPointer()
      return
    }
    lenis.scrollTo(0, SCROLL_ROUTE_TOP)
    unlockLenisPointer()
  }, [pathname, lenis])

  return null
}

function LenisScrollLock() {
  const lenis = useLenis()
  const isMobileMenuOpen = useUiStore((s) => s.isMobileMenuOpen)
  const isSearchOpen = useUiStore((s) => s.isSearchOpen)
  const isCartOpen = useUiStore((s) => s.isCartOpen)
  const scrollLockCount = useUiStore((s) => s.scrollLockCount)
  const locked = isMobileMenuOpen || isSearchOpen || isCartOpen || scrollLockCount > 0
  const freezeRef = useRef(0)

  useLayoutEffect(() => {
    if (!lenis) return
    const win = window as Window & { __SPLARO_LENIS?: typeof lenis }
    win.__SPLARO_LENIS = lenis

    const onScroll = () => rememberLenisScrollY(lenis.scroll)
    const onPointerDown = () => rememberLenisScrollY(lenis.scroll)
    lenis.on('scroll', onScroll)
    document.addEventListener('pointerdown', onPointerDown, true)
    rememberLenisScrollY(lenis.scroll)

    return () => {
      lenis.off('scroll', onScroll)
      document.removeEventListener('pointerdown', onPointerDown, true)
    }
  }, [lenis])

  useLayoutEffect(() => {
    if (!lenis) return
    const html = document.documentElement
    const win = window as Window & { __SPLARO_LENIS?: typeof lenis }
    win.__SPLARO_LENIS = lenis

    if (locked) {
      const freezeY =
        lenis.scroll > 1
          ? lenis.scroll
          : lastLenisScrollY > 1
            ? lastLenisScrollY
            : Number(html.getAttribute('data-scroll-lock-y') || 0) || 0
      freezeRef.current = freezeY
      rememberLenisScrollY(freezeY)
      html.setAttribute('data-scroll-lock', 'overlay')
      html.setAttribute('data-scroll-lock-y', String(freezeY))
      lenis.stop()
      html.classList.add('lenis-stopped')
      lenis.scrollTo(freezeY, { immediate: true })
    } else {
      const freezeY =
        freezeRef.current ||
        Number(html.getAttribute('data-scroll-lock-y') || 0) ||
        lastLenisScrollY ||
        0
      html.removeAttribute('data-scroll-lock')
      html.classList.remove('lenis-stopped')
      lenis.start()
      lenis.scrollTo(freezeY, { immediate: true })
      rememberLenisScrollY(freezeY)
      unlockLenisPointer()
      html.setAttribute('data-lenis-ready', '1')
    }
  }, [lenis, locked])

  return null
}

function LenisHeightSync() {
  const lenis = useLenis()

  useLayoutEffect(() => {
    if (!lenis) return

    let raf = 0
    let timer = 0
    let lastHeight = 0

    const runResize = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const next = document.documentElement.scrollHeight
        // Always refresh limit — deferring during scroll left mid-page freezes
        // when images/rails change document height under the cursor.
        lenis.resize()
        if (Math.abs(next - lastHeight) > 8) {
          lastHeight = next
          requestAnimationFrame(() => lenis.resize())
        } else {
          lastHeight = next
        }
      })
    }

    const scheduleResize = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(runResize, 80)
    }

    const syncLimitOnScroll = () => {
      const nativeMax = Math.max(0, document.documentElement.scrollHeight - window.innerHeight)
      if (Math.abs(nativeMax - lenis.limit) > 12) {
        lenis.resize()
      }
    }

    const target = document.getElementById('main-content') ?? document.body
    const observer = new ResizeObserver(scheduleResize)
    observer.observe(target)
    observer.observe(document.documentElement)

    window.addEventListener('resize', scheduleResize)
    window.addEventListener('orientationchange', scheduleResize)
    window.addEventListener('load', scheduleResize)
    window.visualViewport?.addEventListener('resize', scheduleResize)
    lenis.on('scroll', syncLimitOnScroll)

    const bootPasses = [120, 400, 900, 1800, 3500].map((ms) => window.setTimeout(runResize, ms))

    runResize()

    return () => {
      window.clearTimeout(timer)
      bootPasses.forEach((id) => window.clearTimeout(id))
      cancelAnimationFrame(raf)
      observer.disconnect()
      window.removeEventListener('resize', scheduleResize)
      window.removeEventListener('orientationchange', scheduleResize)
      window.removeEventListener('load', scheduleResize)
      window.visualViewport?.removeEventListener('resize', scheduleResize)
      lenis.off('scroll', syncLimitOnScroll)
    }
  }, [lenis])

  return null
}

function LenisPointerGuard() {
  const lenis = useLenis()

  useLayoutEffect(() => {
    if (!lenis) return

    const unlock = () => unlockLenisPointer()

    const freezeInertia = (event: PointerEvent) => {
      unlock()
      if (event.pointerType === 'touch' && event.isPrimary === false) return
      if (!lenis.isScrolling) return

      const target = event.target
      if (!(target instanceof Element)) return
      const interactive = target.closest(
        'a,button,input,textarea,select,label,summary,[role="button"],[role="link"],[role="menuitem"],[role="tab"],.pp-pressable,.pp-size-btn,.pp-color-thumb,.pdp-size-btn,.pp-btn-add,.pp-btn-store',
      )
      if (!interactive) return

      lenis.scrollTo(lenis.animatedScroll, { immediate: true })
    }

    unlock()
    document.addEventListener('pointerdown', freezeInertia, true)
    document.addEventListener('visibilitychange', unlock)

    return () => {
      document.removeEventListener('pointerdown', freezeInertia, true)
      document.removeEventListener('visibilitychange', unlock)
      unlock()
    }
  }, [lenis])

  return null
}

/**
 * Single Lenis instance for Mac fine-pointer desktop.
 * Options are frozen to the desktop profile — this tree only mounts when
 * shouldUseNativeScroll() is false, so profile churn must not remount ReactLenis.
 */
export function LenisSmoothScrollInner({ children }: { children: ReactNode }) {
  const lenisOptions = useMemo(() => buildLenisOptions('mac'), [])

  useLayoutEffect(() => {
    return () => {
      const html = document.documentElement
      // Sibling dynamic chunks can remount this tree briefly while cart/search
      // is open — do not force engine=native (that flashes like a full reload).
      if (html.getAttribute('data-scroll-lock') === 'overlay') {
        unlockLenisPointer()
        return
      }
      html.classList.remove('lenis', 'lenis-smooth', 'lenis-scrolling', 'lenis-stopped')
      html.removeAttribute('data-lenis-ready')
      if (html.getAttribute('data-scroll-engine') === 'lenis') {
        html.setAttribute('data-scroll-engine', 'native')
      }
      unlockLenisPointer()
    }
  }, [])

  return (
    <ReactLenis root options={lenisOptions}>
      <LenisBootSync />
      <LenisRouteSync />
      <LenisScrollLock />
      <LenisHeightSync />
      <LenisPointerGuard />
      {children}
    </ReactLenis>
  )
}
