'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Count-up for dashboard figures.
 *
 * Two rules the naive version gets wrong, so they are encoded here:
 *
 * 1. It animates *from the previous value*, not from zero. A dashboard
 *    refetches on an interval; replaying 0 → ৳41,200 every poll would make a
 *    steady number look like it kept changing.
 * 2. A number the operator is reading must never be wrong, only early. The
 *    final frame always lands on the exact target rather than on whatever the
 *    easing produced, and reduced-motion returns the target immediately.
 */

export const COUNT_UP_MS = 800

/** Ease-out cubic — fast start, settles gently, no overshoot past the target. */
export function easeOutCubic(t: number): number {
  const clamped = Math.min(1, Math.max(0, t))
  return 1 - Math.pow(1 - clamped, 3)
}

/** Value shown at `elapsed` ms of a `from → to` run. Pure, so it is testable. */
export function countUpFrame(from: number, to: number, elapsed: number, duration = COUNT_UP_MS): number {
  if (duration <= 0 || elapsed >= duration) return to
  if (elapsed <= 0) return from
  return from + (to - from) * easeOutCubic(elapsed / duration)
}

/** True when the number should snap instead of animating. */
export function shouldSkipCountUp(from: number, to: number, reducedMotion: boolean): boolean {
  if (reducedMotion) return true
  if (!Number.isFinite(from) || !Number.isFinite(to)) return true
  // Sub-unit moves are invisible mid-animation and only cost a frame budget.
  return Math.abs(to - from) < 1
}

export function useCountUp(target: number, duration = COUNT_UP_MS): number {
  const [display, setDisplay] = useState(target)
  const fromRef = useRef(target)
  const frameRef = useRef(0)

  useEffect(() => {
    const from = fromRef.current
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true

    if (shouldSkipCountUp(from, target, reduced)) {
      fromRef.current = target
      setDisplay(target)
      return
    }

    const startedAt = performance.now()
    const step = (now: number) => {
      const elapsed = now - startedAt
      const value = countUpFrame(from, target, elapsed, duration)
      setDisplay(value)
      if (elapsed < duration) {
        frameRef.current = requestAnimationFrame(step)
        return
      }
      fromRef.current = target
      setDisplay(target)
    }

    frameRef.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frameRef.current)
  }, [target, duration])

  return display
}
