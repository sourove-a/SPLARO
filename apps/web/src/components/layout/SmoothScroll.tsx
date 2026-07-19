'use client'

import { useLayoutEffect, useState, type ReactNode } from 'react'
import dynamic from 'next/dynamic'
import { usePathname } from 'next/navigation'
import { unlockLenisPointer } from '@/lib/motion/unlock-lenis-pointer'
import { shouldUseNativeScroll } from '@/lib/earth/globe-performance'
import { snapDocumentScrollToTop } from '@/lib/navigation/snap-scroll-top'

const LenisSmoothScrollInner = dynamic(
  () =>
    import('@/components/layout/LenisSmoothScrollInner').then((m) => m.LenisSmoothScrollInner),
  { ssr: false },
)

/** Snap to top on native scroll routes (Lenis path uses LenisRouteSync). */
function RouteScrollTop() {
  const pathname = usePathname()

  useLayoutEffect(() => {
    snapDocumentScrollToTop()
    const raf1 = requestAnimationFrame(() => {
      snapDocumentScrollToTop()
      requestAnimationFrame(snapDocumentScrollToTop)
    })
    const t50 = window.setTimeout(snapDocumentScrollToTop, 50)
    const t150 = window.setTimeout(snapDocumentScrollToTop, 150)
    const t300 = window.setTimeout(snapDocumentScrollToTop, 300)
    return () => {
      cancelAnimationFrame(raf1)
      window.clearTimeout(t50)
      window.clearTimeout(t150)
      window.clearTimeout(t300)
    }
  }, [pathname])

  return null
}

/**
 * Premium scroll:
 * - Mac / Linux desktop → Lenis inertia
 * - Windows / mobile / lite / reduced-motion → native (Windows lock)
 */
export function SmoothScroll({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false)
  const [useNative, setUseNative] = useState(true)

  useLayoutEffect(() => {
    setMounted(true)
    const update = () => setUseNative(shouldUseNativeScroll())
    update()
    window.addEventListener('resize', update)
    window.addEventListener('orientationchange', update)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('orientationchange', update)
    }
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
