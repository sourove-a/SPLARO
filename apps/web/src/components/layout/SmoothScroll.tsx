'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { ReactLenis, useLenis } from 'lenis/react'
import { useUiStore } from '@/store/uiStore'
import {
  buildLenisOptions,
  isTouchScrollProfile,
  SCROLL_ROUTE_TOP,
  subscribeSmoothScrollEligibility,
} from '@/lib/motion/scroll'
import 'lenis/dist/lenis.css'

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

export function SmoothScroll({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(false)
  const [touchProfile, setTouchProfile] = useState(false)

  useEffect(() => {
    const syncProfile = () => setTouchProfile(isTouchScrollProfile())
    syncProfile()

    const unsubEligibility = subscribeSmoothScrollEligibility(setEnabled)

    const mq = window.matchMedia('(max-width: 1023px)')
    const mqCoarse = window.matchMedia('(pointer: coarse)')
    mq.addEventListener('change', syncProfile)
    mqCoarse.addEventListener('change', syncProfile)

    return () => {
      unsubEligibility()
      mq.removeEventListener('change', syncProfile)
      mqCoarse.removeEventListener('change', syncProfile)
    }
  }, [])

  const lenisOptions = useMemo(() => buildLenisOptions(), [touchProfile])

  if (!enabled) return <>{children}</>

  return (
    <ReactLenis root options={lenisOptions} key={touchProfile ? 'touch' : 'wheel'}>
      <LenisRouteSync />
      <LenisScrollLock />
      {children}
    </ReactLenis>
  )
}
