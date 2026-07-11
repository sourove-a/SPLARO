'use client'

import { useLayoutEffect, useMemo, useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { ReactLenis, useLenis } from 'lenis/react'
import { useUiStore } from '@/store/uiStore'
import { unlockLenisPointer } from '@/lib/motion/unlock-lenis-pointer'
import {
  buildLenisOptions,
  SCROLL_ROUTE_TOP,
  subscribeSmoothScrollEligibility,
} from '@/lib/motion/scroll'

function LenisRouteSync() {
  const pathname = usePathname()
  const lenis = useLenis()

  useLayoutEffect(() => {
    if (!lenis) return
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
  const locked = isMobileMenuOpen || isSearchOpen || isCartOpen

  useLayoutEffect(() => {
    if (!lenis) return
    if (locked) {
      lenis.stop()
    } else {
      lenis.start()
      unlockLenisPointer()
    }
  }, [lenis, locked])

  return null
}

/** Prevent Windows dead-clicks when Lenis pauses or scroll ends without clearing inline locks. */
function LenisPointerGuard() {
  const lenis = useLenis()

  useLayoutEffect(() => {
    if (!lenis) return

    let raf = 0
    const scheduleUnlock = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(unlockLenisPointer)
    }

    lenis.on('scroll', scheduleUnlock)

    const onPointerDown = () => scheduleUnlock()
    const onVisibility = () => {
      if (document.visibilityState === 'visible') scheduleUnlock()
    }

    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('visibilitychange', onVisibility)
    scheduleUnlock()

    return () => {
      cancelAnimationFrame(raf)
      lenis.off('scroll', scheduleUnlock)
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('visibilitychange', onVisibility)
      unlockLenisPointer()
    }
  }, [lenis])

  return null
}

export function SmoothScroll({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(false)

  useLayoutEffect(() => {
    return subscribeSmoothScrollEligibility(setEnabled)
  }, [])

  const lenisOptions = useMemo(() => buildLenisOptions(), [])

  if (!enabled) return <>{children}</>

  return (
    <ReactLenis root options={lenisOptions}>
      <LenisRouteSync />
      <LenisScrollLock />
      <LenisPointerGuard />
      {children}
    </ReactLenis>
  )
}
