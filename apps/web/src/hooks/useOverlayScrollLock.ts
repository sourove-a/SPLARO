'use client'

import { useEffect } from 'react'
import { useUiStore } from '@/store/uiStore'

/**
 * Freeze background scroll via html[data-scroll-lock=overlay]
 * (GlobalDeviceUx OverlayScrollLockAttr + globals.css).
 * Never set document.body.style.overflow — that dual-locks Windows/native scroll.
 */
export function useOverlayScrollLock(active: boolean) {
  const acquireScrollLock = useUiStore((s) => s.acquireScrollLock)
  const releaseScrollLock = useUiStore((s) => s.releaseScrollLock)

  useEffect(() => {
    if (!active) return
    acquireScrollLock()
    return () => {
      releaseScrollLock()
    }
  }, [active, acquireScrollLock, releaseScrollLock])
}
