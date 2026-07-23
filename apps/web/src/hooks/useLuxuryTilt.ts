'use client'

import {
  useCallback,
  useEffect,
  useRef,
  type PointerEvent,
  type RefObject,
} from 'react'
import { MOTION } from '@/lib/motion/config'

type UseLuxuryTiltOptions = {
  /** Max rotate in degrees (Motion Language = 2). */
  maxDeg?: number
  enabled?: boolean
}

/**
 * Gentle 2° mouse-follow for Pearl glass — no bounce, 320ms CSS settle.
 * Disabled on touch, lite, and reduced-motion.
 */
export function useLuxuryTilt<T extends HTMLElement>(
  options: UseLuxuryTiltOptions = {},
): {
  ref: RefObject<T | null>
  onPointerMove: (event: PointerEvent<T>) => void
  onPointerLeave: () => void
} {
  const { maxDeg = MOTION.tiltDeg, enabled = true } = options
  const ref = useRef<T | null>(null)
  const allowedRef = useRef(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const lite = document.documentElement.getAttribute('data-perf') === 'lite'
    allowedRef.current = Boolean(enabled && fine && !reduce && !lite)
  }, [enabled])

  const reset = useCallback(() => {
    const el = ref.current
    if (!el) return
    el.style.setProperty('--tilt-x', '0deg')
    el.style.setProperty('--tilt-y', '0deg')
  }, [])

  const onPointerMove = useCallback(
    (event: PointerEvent<T>) => {
      if (!allowedRef.current) return
      const el = ref.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      if (rect.width < 8 || rect.height < 8) return
      const px = (event.clientX - rect.left) / rect.width - 0.5
      const py = (event.clientY - rect.top) / rect.height - 0.5
      const tiltX = (-py * maxDeg * 2).toFixed(2)
      const tiltY = (px * maxDeg * 2).toFixed(2)
      el.style.setProperty('--tilt-x', `${tiltX}deg`)
      el.style.setProperty('--tilt-y', `${tiltY}deg`)
    },
    [maxDeg],
  )

  const onPointerLeave = useCallback(() => {
    reset()
  }, [reset])

  return { ref, onPointerMove, onPointerLeave }
}
