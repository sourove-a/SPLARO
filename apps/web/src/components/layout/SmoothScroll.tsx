'use client'

import { useLayoutEffect, useState, type ReactNode } from 'react'
import dynamic from 'next/dynamic'
import { unlockLenisPointer } from '@/lib/motion/unlock-lenis-pointer'
import { shouldUseNativeScroll } from '@/lib/earth/globe-performance'

const LenisSmoothScrollInner = dynamic(
  () =>
    import('@/components/layout/LenisSmoothScrollInner').then((m) => m.LenisSmoothScrollInner),
  { ssr: false },
)

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
    html.setAttribute('data-splaro-booted', '1')
    unlockLenisPointer()
  }, [mounted, useNative])

  if (!mounted || useNative) {
    return <>{children}</>
  }

  return <LenisSmoothScrollInner>{children}</LenisSmoothScrollInner>
}
