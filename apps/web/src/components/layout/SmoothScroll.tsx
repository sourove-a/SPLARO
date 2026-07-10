'use client'

import { useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { ReactLenis, useLenis } from 'lenis/react'
import { useUiStore } from '@/store/uiStore'
import {
  buildLenisOptions,
  isWindowsClient,
  SCROLL_ROUTE_TOP,
  subscribeSmoothScrollEligibility,
} from '@/lib/motion/scroll'

function LenisRouteSync() {
  const pathname = usePathname()
  const lenis = useLenis()

  useEffect(() => {
    if (!lenis) return
    lenis.scrollTo(0, SCROLL_ROUTE_TOP)
  }, [pathname, lenis])

  return null
}

function LenisScrollLock() {
  const lenis = useLenis()
  const isMobileMenuOpen = useUiStore((s) => s.isMobileMenuOpen)
  const isSearchOpen = useUiStore((s) => s.isSearchOpen)
  const isCartOpen = useUiStore((s) => s.isCartOpen)
  const locked = isMobileMenuOpen || isSearchOpen || isCartOpen

  useEffect(() => {
    if (!lenis) return
    if (locked) lenis.stop()
    else lenis.start()
  }, [lenis, locked])

  return null
}

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

export function SmoothScroll({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(false)

  useIsomorphicLayoutEffect(() => {
    if (isWindowsClient() || (window as Window & { __splaroNativeScroll?: boolean }).__splaroNativeScroll) {
      setEnabled(false)
      return
    }
    const unsubEligibility = subscribeSmoothScrollEligibility(setEnabled)
    return unsubEligibility
  }, [])

  const lenisOptions = useMemo(() => buildLenisOptions(), [])

  if (!enabled) return <>{children}</>

  return (
    <ReactLenis root options={lenisOptions}>
      <LenisRouteSync />
      <LenisScrollLock />
      {children}
    </ReactLenis>
  )
}
