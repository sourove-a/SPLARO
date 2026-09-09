'use client'

import {
  Suspense,
  startTransition,
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
    // Swapping the native fragment for the lazy Lenis branch changes the element
    // type in this slot, so React remounts the whole chrome tree below it. Done
    // as an urgent update, React suspends on the not-yet-loaded Lenis chunk,
    // hides the current tree with `display: none` instead of deleting it, and
    // paints the Suspense fallback — the header disappears and then drops back
    // in, and the document is left holding a dead second copy of the topbar,
    // header, main and footer that every `document.querySelector` finds first.
    // In a transition React prepares the new branch off-screen and swaps once,
    // keeping the visible tree on screen and unmounting the old one cleanly.
    startTransition(() => setUseNative(shouldUseNativeScroll()))
    return subscribeSmoothScrollEligibility((eligible) => {
      startTransition(() => setUseNative(!eligible))
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

  const lenisActive = mounted && !useNative

  // `children` keep the same slot in both engines, so switching to Lenis can no
  // longer remount the header, topbar, main and footer beneath it. The lazy
  // engine gets its own boundary as well — without one, its chunk suspends the
  // chrome boundary above, which hides the live tree and leaves a dead copy in
  // the document for every `document.querySelector` to find.
  return (
    <>
      {lenisActive ? (
        <Suspense fallback={null}>
          <LenisSmoothScrollInner />
        </Suspense>
      ) : (
        <RouteScrollTop />
      )}
      {children}
    </>
  )
}

/** @deprecated Prefer SmoothScrollProvider — kept for StorefrontChrome import. */
export const SmoothScroll = SmoothScrollProvider
