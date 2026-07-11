'use client'

import { useEffect, type RefObject } from 'react'

/** Map vertical mouse wheel → horizontal scroll inside overflow tracks (Windows mouse UX). */
export function useHorizontalWheelScroll(ref: RefObject<HTMLElement | null>, enabled = true) {
  useEffect(() => {
    if (!enabled) return
    const el = ref.current
    if (!el) return

    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey) return
      if (event.defaultPrevented) return
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return
      if (el.scrollWidth <= el.clientWidth + 1) return

      const max = el.scrollWidth - el.clientWidth
      const goingRight = event.deltaY > 0
      if ((goingRight && el.scrollLeft >= max - 1) || (!goingRight && el.scrollLeft <= 1)) return

      event.preventDefault()
      el.scrollLeft += event.deltaY
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [ref, enabled])
}
