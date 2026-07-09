'use client'

import { useEffect } from 'react'
import { preloadFooterEarthAssets } from '@/lib/earth/textures'
import { isMobileViewport } from '@/lib/hooks/use-mobile-viewport'
import { isSmoothScrollEligible } from '@/lib/motion/scroll'

/** Warm earth assets as early as possible so footer globe is ready before scroll reaches it. */
export function FooterEarthPreloader() {
  useEffect(() => {
    if (isMobileViewport() || !isSmoothScrollEligible()) return

    const win = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
      cancelIdleCallback?: (id: number) => void
    }

    let idleId: number | undefined
    let timer: ReturnType<typeof setTimeout> | undefined

    const run = () => void preloadFooterEarthAssets()

    // Defer heavy Three.js preload — avoids blue earth flash during initial page paint.
    if (win.requestIdleCallback) {
      idleId = win.requestIdleCallback(run, { timeout: 4000 })
    } else {
      timer = setTimeout(run, 1200)
    }

    return () => {
      if (idleId !== undefined) win.cancelIdleCallback?.(idleId)
      if (timer !== undefined) clearTimeout(timer)
    }
  }, [])

  return null
}
