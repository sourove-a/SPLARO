'use client'

import { useEffect, useRef, useState } from 'react'

export function subscribeScroll(onScroll: (y: number) => void) {
  let rafId = 0
  let pendingY = 0

  const flush = () => {
    rafId = 0
    onScroll(pendingY)
  }

  const schedule = (y: number) => {
    pendingY = y
    if (rafId === 0) rafId = window.requestAnimationFrame(flush)
  }

  schedule(window.scrollY)
  const handler = () => schedule(window.scrollY)
  window.addEventListener('scroll', handler, { passive: true })
  return () => {
    window.removeEventListener('scroll', handler)
    if (rafId !== 0) window.cancelAnimationFrame(rafId)
  }
}

function isMobileViewport() {
  return window.matchMedia('(max-width: 1023px)').matches
}

export function useScrollY(threshold = 0) {
  const [pastThreshold, setPastThreshold] = useState(false)

  useEffect(() => {
    let past = false

    const check = (y: number) => {
      const next = y > threshold
      if (next === past) return
      past = next
      setPastThreshold(next)
    }

    return subscribeScroll(check)
  }, [threshold])

  return pastThreshold
}

/** Silk spring — desktop header hide/show */
export const headerMotionTransition = {
  type: 'spring' as const,
  stiffness: 220,
  damping: 28,
  mass: 0.95,
}

/** Smooth ease — mobile header (no bounce) */
export const headerMobileMotionTransition = {
  duration: 0.38,
  ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
}

export const headerGlassCssEase = '520ms cubic-bezier(0.22, 1, 0.36, 1)'

export function useHeaderScroll(
  threshold = 24,
  pinned = false,
): { isScrolled: boolean; isHidden: boolean } {
  const [state, setState] = useState({ isScrolled: false, isHidden: false })
  const stateRef = useRef(state)

  useEffect(() => {
    stateRef.current = state
  }, [state])

  useEffect(() => {
    let lastY = 0
    let accumulated = 0

    const HIDE_DELTA = 56
    const SHOW_DELTA = 28
    const TOP_LOCK = 20

    const commit = (nextScrolled: boolean, nextHidden: boolean) => {
      const current = stateRef.current
      if (current.isScrolled === nextScrolled && current.isHidden === nextHidden) return
      const next = { isScrolled: nextScrolled, isHidden: nextHidden }
      stateRef.current = next
      setState(next)
    }

    const showHeader = (y: number) => {
      commit(y > threshold, false)
    }

    const update = (y: number) => {
      const delta = y - lastY
      lastY = y
      const nextScrolled = y > threshold

      if (pinned) {
        showHeader(y)
        accumulated = 0
        return
      }

      if (isMobileViewport()) {
        showHeader(y)
        return
      }

      let nextHidden = stateRef.current.isHidden

      if (y <= TOP_LOCK) {
        nextHidden = false
        accumulated = 0
      } else if (delta > 0) {
        accumulated = accumulated > 0 ? accumulated + delta : delta
        if (!nextHidden && accumulated >= HIDE_DELTA) {
          nextHidden = true
          accumulated = 0
        }
      } else if (delta < 0) {
        accumulated = accumulated < 0 ? accumulated + delta : delta
        if (nextHidden && accumulated <= -SHOW_DELTA) {
          nextHidden = false
          accumulated = 0
        }
      }

      commit(nextScrolled, nextHidden)
    }

    return subscribeScroll(update)
  }, [threshold, pinned])

  return pinned ? { ...state, isHidden: false } : state
}

export function useScrollPastViewport(ratio = 0.55) {
  const [pastThreshold, setPastThreshold] = useState(false)

  useEffect(() => {
    let past = false

    const check = (y: number) => {
      const next = y > window.innerHeight * ratio
      if (next === past) return
      past = next
      setPastThreshold(next)
    }

    const unsubscribe = subscribeScroll(check)
    const onResize = () => check(window.scrollY)

    window.addEventListener('resize', onResize, { passive: true })
    return () => {
      unsubscribe()
      window.removeEventListener('resize', onResize)
    }
  }, [ratio])

  return pastThreshold
}

export function useScrollToTop() {
  return () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}
