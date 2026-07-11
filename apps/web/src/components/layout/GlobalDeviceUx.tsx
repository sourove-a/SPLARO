'use client'

import { useEffect } from 'react'
import { unlockLenisPointer } from '@/lib/motion/unlock-lenis-pointer'

/**
 * Maps vertical mouse wheel → horizontal scroll for any overflow-x container under the cursor.
 * Covers legacy tracks without HorizontalScrollRail (Windows mouse UX).
 */
export function GlobalHorizontalWheelScroll() {
  useEffect(() => {
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey) return
      if (event.defaultPrevented) return
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return

      let node = event.target as HTMLElement | null
      while (node && node !== document.documentElement) {
        if (node.getAttribute('data-h-scroll') === 'true') return

        const style = getComputedStyle(node)
        const overflowX = style.overflowX
        if (
          (overflowX === 'auto' || overflowX === 'scroll' || overflowX === 'overlay') &&
          node.scrollWidth > node.clientWidth + 1
        ) {
          const max = node.scrollWidth - node.clientWidth
          const goingRight = event.deltaY > 0
          if ((goingRight && node.scrollLeft >= max - 1) || (!goingRight && node.scrollLeft <= 1)) {
            return
          }

          event.preventDefault()
          node.scrollLeft += event.deltaY
          return
        }
        node = node.parentElement
      }
    }

    document.addEventListener('wheel', onWheel, { passive: false, capture: true })
    return () => document.removeEventListener('wheel', onWheel, { capture: true })
  }, [])

  return null
}

/** Safety net — never leave the storefront unclickable after Lenis / overlay glitches. */
export function GlobalPointerSafety() {
  useEffect(() => {
    const unlock = () => unlockLenisPointer()

    unlock()
    document.addEventListener('pointerdown', unlock, true)
    document.addEventListener('visibilitychange', unlock)
    window.addEventListener('focus', unlock)

    return () => {
      document.removeEventListener('pointerdown', unlock, true)
      document.removeEventListener('visibilitychange', unlock)
      window.removeEventListener('focus', unlock)
      unlock()
    }
  }, [])

  return null
}
