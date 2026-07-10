'use client'

import { useEffect } from 'react'
import { shouldPreloadEarthAssets } from '@/lib/earth/globe-performance'
import { preloadFooterEarthAssets } from '@/lib/earth/textures'

/** Warm earth assets when idle — mobile included; respects save-data + reduced-motion only. */
export function FooterEarthPreloader() {
  useEffect(() => {
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
  }, [])

  return null
}
