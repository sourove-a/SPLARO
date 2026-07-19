'use client'

import { useEffect, type RefObject } from 'react'
import { isWindowsOS } from '@/lib/earth/globe-performance'

/**
 * Horizontal rail wheel support.
 * Never steal plain vertical wheel on Windows; it makes page scroll feel stuck
 * whenever the pointer sits over product/category rails.
 */
export function useHorizontalWheelScroll(ref: RefObject<HTMLElement | null>, enabled = true) {
  useEffect(() => {
    if (!enabled) return
    const el = ref.current
    if (!el) return

    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey) return
      if (event.defaultPrevented) return
      const wantsHorizontal = Math.abs(event.deltaX) > Math.abs(event.deltaY)
      const shiftWheel = event.shiftKey && Math.abs(event.deltaY) > Math.abs(event.deltaX)
      if (!wantsHorizontal && !shiftWheel) return
      if (el.scrollWidth <= el.clientWidth + 1) return

      const max = el.scrollWidth - el.clientWidth
      const delta = wantsHorizontal ? event.deltaX : event.deltaY
      const goingRight = delta > 0
      if ((goingRight && el.scrollLeft >= max - 1) || (!goingRight && el.scrollLeft <= 1)) return

      if (shiftWheel || isWindowsOS()) event.preventDefault()
      el.scrollLeft += delta
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [ref, enabled])
}
