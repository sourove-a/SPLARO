'use client'

import { useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { ReactLenis, useLenis } from 'lenis/react'
import { useUiStore } from '@/store/uiStore'
import { unlockLenisPointer } from '@/lib/motion/unlock-lenis-pointer'
import {
  buildLenisOptions,
  detectScrollProfile,
  SCROLL_BOOT,
  SCROLL_ROUTE_TOP,
  subscribeScrollProfile,
  type ScrollProfile,
} from '@/lib/motion/scroll'
import { shouldUseNativeScroll } from '@/lib/earth/globe-performance'

function usePrefersReducedMotion() {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
      mq.addEventListener('change', onChange)
      return () => mq.removeEventListener('change', onChange)
    },
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    () => false,
  )
}

function useScrollProfile() {
  return useSyncExternalStore(
    subscribeScrollProfile,
    detectScrollProfile,
    (): ScrollProfile => 'mac',
  )
}

function useLenisMountReady() {
  const [ready, setReady] = useState(false)

  useLayoutEffect(() => {
    setReady(true)
  }, [])

  return ready
}

function LenisBootSync() {
  const lenis = useLenis()

  useLayoutEffect(() => {
    if (!lenis) return

    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual'
    }

    const html = document.documentElement
    html.setAttribute('data-scroll-engine', 'lenis')
    lenis.start()
    lenis.resize()
    lenis.scrollTo(0, SCROLL_BOOT)
    unlockLenisPointer()

    requestAnimationFrame(() => {
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
    return () => window.removeEventListener('pageshow', onPageShow)
  }, [lenis])

  return null
}

function LenisRouteSync() {
  const pathname = usePathname()
  const lenis = useLenis()
  const isFirstRoute = useRef(true)

  useLayoutEffect(() => {
    if (!lenis) return
    if (isFirstRoute.current) {
      isFirstRoute.current = false
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

  useLayoutEffect(() => {
    if (!lenis) return
    const html = document.documentElement
    if (locked) {
      html.setAttribute('data-scroll-lock', 'overlay')
      lenis.stop()
    } else {
      html.removeAttribute('data-scroll-lock')
      lenis.start()
      unlockLenisPointer()
      html.setAttribute('data-lenis-ready', '1')
    }
  }, [lenis, locked])

  return null
}

/** Debounced resize when catalog/images/earth change page height mid-scroll. */
function LenisHeightSync() {
  const lenis = useLenis()

  useLayoutEffect(() => {
    if (!lenis) return

    let raf = 0
    let timer = 0

    const scheduleResize = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        cancelAnimationFrame(raf)
        raf = requestAnimationFrame(() => lenis.resize())
      }, 90)
    }

    const target = document.getElementById('main-content') ?? document.body
    const observer = new ResizeObserver(scheduleResize)
    observer.observe(target)

    window.addEventListener('resize', scheduleResize)
    window.addEventListener('orientationchange', scheduleResize)
    window.visualViewport?.addEventListener('resize', scheduleResize)

    scheduleResize()

    return () => {
      window.clearTimeout(timer)
      cancelAnimationFrame(raf)
      observer.disconnect()
      window.removeEventListener('resize', scheduleResize)
      window.removeEventListener('orientationchange', scheduleResize)
      window.visualViewport?.removeEventListener('resize', scheduleResize)
    }
  }, [lenis])

  return null
}

/** Clear stuck Lenis scroll state after wheel/touch stops (middle-page freeze guard). */
function LenisScrollIdleRecovery() {
  const lenis = useLenis()
  const locked = useUiStore(
    (s) =>
      s.isMobileMenuOpen || s.isSearchOpen || s.isCartOpen || s.scrollLockCount > 0,
  )

  useLayoutEffect(() => {
    if (!lenis) return

    let idleTimer = 0

    const onIdle = () => {
      window.clearTimeout(idleTimer)
      idleTimer = window.setTimeout(() => {
        if (locked) return
        document.documentElement.classList.remove('lenis-scrolling')
        lenis.start()
      }, 140)
    }

    const onScroll = () => {
      onIdle()
    }

    lenis.on('scroll', onScroll)
    onIdle()

    return () => {
      window.clearTimeout(idleTimer)
      lenis.off('scroll', onScroll)
    }
  }, [lenis, locked])

  return null
}

function LenisPointerGuard() {
  const lenis = useLenis()

  useLayoutEffect(() => {
    if (!lenis) return

    const unlock = () => unlockLenisPointer()

    /**
     * Freeze inertia only when the user is aiming at a control.
     * Do NOT freeze on every touch/pointer — that steals mobile pan gestures.
     */
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

export function SmoothScroll({ children }: { children: ReactNode }) {
  const mountLenis = useLenisMountReady()
  const reducedMotion = usePrefersReducedMotion()
  const profile = useScrollProfile()
  const [nativeScroll, setNativeScroll] = useState(false)

  useLayoutEffect(() => {
    // Soft-GL / lite: native scroll — Lenis autoRaf + CPU WebGL starved Search/slider.
    setNativeScroll(shouldUseNativeScroll())
  }, [])

  const useNative = reducedMotion || nativeScroll

  const lenisOptions = useMemo(() => {
    const opts = buildLenisOptions(profile)
    if (!reducedMotion) return opts
    return {
      ...opts,
      lerp: 1,
      smoothWheel: false,
      syncTouch: false,
      wheelMultiplier: 1,
      touchMultiplier: 1,
    }
  }, [profile, reducedMotion])

  useLayoutEffect(() => {
    if (mountLenis && !useNative) return
    const html = document.documentElement
    html.setAttribute('data-scroll-engine', 'native')
    html.removeAttribute('data-lenis-ready')
    html.setAttribute('data-splaro-booted', '1')
    unlockLenisPointer()
  }, [mountLenis, useNative])

  useLayoutEffect(() => {
    if (!mountLenis || useNative) return
    const html = document.documentElement
    html.setAttribute('data-scroll-engine', 'lenis')
    unlockLenisPointer()
  }, [mountLenis, useNative])

  if (!mountLenis || useNative) {
    return <>{children}</>
  }

  return (
    <ReactLenis root options={lenisOptions}>
      <LenisBootSync />
      <LenisRouteSync />
      <LenisScrollLock />
      <LenisHeightSync />
      <LenisScrollIdleRecovery />
      <LenisPointerGuard />
      {children}
    </ReactLenis>
  )
}
