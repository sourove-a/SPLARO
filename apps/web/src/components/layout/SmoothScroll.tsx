'use client'

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import dynamic from 'next/dynamic'
import { usePathname } from 'next/navigation'
import { unlockLenisPointer } from '@/lib/motion/unlock-lenis-pointer'
import { shouldUseNativeScroll } from '@/lib/earth/globe-performance'
import { subscribeSmoothScrollEligibility } from '@/lib/motion/scroll'
import { snapDocumentScrollToTop } from '@/lib/navigation/snap-scroll-top'

const LenisSmoothScrollInner = dynamic(
  () =>
    import('@/components/layout/LenisSmoothScrollInner').then((m) => m.LenisSmoothScrollInner),
  { ssr: false },
)

/** Soft nav → top; browser back/forward (popstate) keeps position. */
function usePopNavigationFlag() {
  const isPopNavigation = useRef(false)

  useEffect(() => {
    const onPopState = () => {
      isPopNavigation.current = true
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  return isPopNavigation
}

/** Snap to top on native scroll routes (Lenis path uses LenisRouteSync). */
function RouteScrollTop() {
  const pathname = usePathname()
  const isFirstRoute = useRef(true)
  const isPopNavigation = usePopNavigationFlag()

  useLayoutEffect(() => {
    if (isFirstRoute.current) {
      isFirstRoute.current = false
      return
    }
    if (isPopNavigation.current) {
      isPopNavigation.current = false
      return
    }
    snapDocumentScrollToTop()
    const raf1 = requestAnimationFrame(() => {
      snapDocumentScrollToTop()
    })
    return () => {
      cancelAnimationFrame(raf1)
    }
  }, [pathname, isPopNavigation])

  return null
}

/**
 * Maximum premium scroll without regressing stability:
 * - Mac / Linux fine desktop → Lenis (lerp inertia, rail-safe virtualScroll)
 * - Windows / mobile / lite / reduced-motion → native OS scroll
 */
export function SmoothScrollProvider({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false)
  const [useNative, setUseNative] = useState(true)

  useLayoutEffect(() => {
    setMounted(true)
    setUseNative(shouldUseNativeScroll())
    return subscribeSmoothScrollEligibility((eligible) => {
      setUseNative(!eligible)
    })
  }, [])

  useLayoutEffect(() => {
    if (!mounted || !useNative) return
    const html = document.documentElement
    html.setAttribute('data-scroll-engine', 'native')
    html.removeAttribute('data-lenis-ready')
    html.classList.remove('lenis', 'lenis-smooth', 'lenis-scrolling', 'lenis-stopped')
    html.setAttribute('data-splaro-booted', '1')
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual'
    }
    unlockLenisPointer()
    const win = window as Window & { __SPLARO_LENIS?: unknown }
    delete win.__SPLARO_LENIS
  }, [mounted, useNative])

  if (!mounted || useNative) {
    return (
      <>
        <RouteScrollTop />
        {children}
      </>
    )
  }

  return <LenisSmoothScrollInner>{children}</LenisSmoothScrollInner>
}

/** @deprecated Prefer SmoothScrollProvider — kept for StorefrontChrome import. */
export const SmoothScroll = SmoothScrollProvider
