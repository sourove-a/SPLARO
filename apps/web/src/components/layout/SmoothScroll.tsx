'use client'

import { useLayoutEffect, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { unlockLenisPointer } from '@/lib/motion/unlock-lenis-pointer'

/** Snap to top on every client route change (replaces LenisRouteSync). */
function RouteScrollTop() {
  const pathname = usePathname()

  useLayoutEffect(() => {
    const snap = () => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
      document.documentElement.scrollTop = 0
      document.body.scrollTop = 0
    }
    // Layout + dual rAF + macrotask — Next soft-nav can restore scroll after first paint.
    snap()
    const raf1 = requestAnimationFrame(() => {
      snap()
      requestAnimationFrame(snap)
    })
    const t = window.setTimeout(snap, 50)
    return () => {
      cancelAnimationFrame(raf1)
      window.clearTimeout(t)
    }
  }, [pathname])

  return null
}

/** Native document scroll only — Lenis graph removed (always-native since 2026-07-16). */
export function SmoothScroll({ children }: { children: ReactNode }) {
  useLayoutEffect(() => {
    const html = document.documentElement
    html.setAttribute('data-scroll-engine', 'native')
    html.removeAttribute('data-lenis-ready')
    html.setAttribute('data-splaro-booted', '1')
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual'
    }
    unlockLenisPointer()
  }, [])

  return (
    <>
      <RouteScrollTop />
      {children}
    </>
  )
}
