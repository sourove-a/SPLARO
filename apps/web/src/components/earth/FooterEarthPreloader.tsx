'use client'

import { useEffect } from 'react'
import { preloadFooterEarthAssets } from '@/lib/earth/textures'

/** Warm earth assets as early as possible so footer globe is ready before scroll reaches it. */
export function FooterEarthPreloader() {
  useEffect(() => {
    const win = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
      cancelIdleCallback?: (id: number) => void
    }

    let idleId: number | undefined
    let timer: ReturnType<typeof setTimeout> | undefined

    const run = () => void preloadFooterEarthAssets()

    if (win.requestIdleCallback) {
      idleId = win.requestIdleCallback(run, { timeout: 800 })
    } else {
      timer = setTimeout(run, 200)
    }

    return () => {
      if (idleId !== undefined) win.cancelIdleCallback?.(idleId)
      if (timer !== undefined) clearTimeout(timer)
    }
  }, [])

  return null
}
