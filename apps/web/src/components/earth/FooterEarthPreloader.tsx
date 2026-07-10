'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { shouldPreloadEarthAssets } from '@/lib/earth/globe-performance'
import { preloadFooterEarthAssets } from '@/lib/earth/textures'

/** Warm earth textures when idle — skip homepage (story earth handles it). */
export function FooterEarthPreloader() {
  const pathname = usePathname()

  useEffect(() => {
    if (pathname === '/') return
    if (!shouldPreloadEarthAssets()) return

    const win = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
      cancelIdleCallback?: (id: number) => void
    }

    let idleId: number | undefined
    let timer: ReturnType<typeof setTimeout> | undefined

    const run = () => void preloadFooterEarthAssets()

    if (win.requestIdleCallback) {
      idleId = win.requestIdleCallback(run, { timeout: 4000 })
    } else {
      timer = setTimeout(run, 1200)
    }

    return () => {
      if (idleId !== undefined) win.cancelIdleCallback?.(idleId)
      if (timer !== undefined) clearTimeout(timer)
    }
  }, [pathname])

  return null
}
